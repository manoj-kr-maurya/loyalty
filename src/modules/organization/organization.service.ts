import { Injectable } from '@nestjs/common';
import {
  Invite,
  MetaFlagsForOrganization,
  Organization,
  OrganizationRoles,
} from '@prisma/client';
import to from 'await-to-js';
import {
  InviteShopForm,
  LoginOrganizationOtpForm,
  ValidateOrganizationOtpForm,
  SendInterestForm,
  UpdateOrganizationForm,
} from './DTO/organizations.dto';
import {
  CurrencyBucketAlreadyInitialiedForThisOrganizationException,
  CurrencyDoesNotExistsForThisOrganizationException,
  InvalidAdminOrganizationException,
  WrongOrganizationOtpException,
} from './exceptions/organization.exception';
import { CommonDBService } from 'src/common/services/common-db.service';
import { AuthService } from '../auth/auth.service';
import { UserTypes } from 'src/common/enums/user-types';
import { OrganizationPrismaHelperService } from './organization-prisma-helper.service';
import { ImgBBService } from 'src/modules/imgbb/imgbb.service';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { PrismaService } from 'src/common/services/prismaService';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly authService: AuthService,
    private readonly commonDbService: CommonDBService,
    private readonly organizationPrismaHelperService: OrganizationPrismaHelperService,
    private readonly imgbbService: ImgBBService,
    private readonly prismaService: PrismaService,
  ) {}

  getOrganizationWithCampaignsAndMetaFlags(organizationId: string) {
    return this.organizationPrismaHelperService.getOrganizationWithCampaignsAndMetaFlags(
      organizationId,
    );
  }

  getOrganizationWithCurrenciesAndCurrencyBuckets(organizationId: string) {
    return this.organizationPrismaHelperService.getOrganizationWithCurrenciesAndCurrencyBuckets(
      organizationId,
    );
  }

  async findOrCreateOrganizationAndProceedPhoneAuthentication(
    form: LoginOrganizationOtpForm,
  ) {
    let invite: Invite | null = null;
    try {
      invite = await this.commonDbService.findInvite({
        assignedTo: form.phoneNumber,
      });
    } catch {
      // No invite found — allow self-registration as ADMIN
    }

    const role = invite?.role || OrganizationRoles.ADMIN;
    const orgAdminId = invite?.orgAdminId || undefined;

    const organization = await this.findOrCreateOrganization({
      ...form,
      role,
      orgAdminId,
    });

    if (organization.role === OrganizationRoles.ADMIN) {
      this.updateOrganization({ ...organization, orgAdminId: organization.id });
    }
    await this.authService.sendLoginOtp({
      userType: UserTypes.organization,
      referenceId: organization.id,
      phoneNumber: organization.phoneNumber,
      countryCode: organization.countryCode,
    });

    return organization.id.toString();
  }

  private async findOrCreateOrganization(
    form: LoginOrganizationOtpForm,
  ): Promise<Organization> {
    const [error, existingOrganization] = await to(
      this.organizationPrismaHelperService.findOrganization({
        phoneNumber: form.phoneNumber,
      }),
    );
    if (existingOrganization && !error) {
      return existingOrganization;
    }

    const createdOrganization =
      await this.organizationPrismaHelperService.createOrganization({
        ...form,
        metaFlags: { create: this.getDefaultMetaFlagsForOrg(form.role) },
      });
    return createdOrganization;
  }

  getDefaultMetaFlagsForOrg(role: OrganizationRoles) {
    const initJourneyCompleted = OrganizationRoles.SHOP === role;
    return { initJourneyCompleted: initJourneyCompleted };
  }

  async validateOtpAndGenerateToken(
    form: ValidateOrganizationOtpForm,
  ): Promise<{
    metaFlags: MetaFlagsForOrganization;
    organization: Organization;
  }> {
    const isItTheCorrectOtp = await this.authService.validateLoginOtp({
      referenceId: form.id,
      otp: form.otp,
    });
    if (!isItTheCorrectOtp) {
      throw new WrongOrganizationOtpException();
    }

    const organization = await this.getOrganization(form.id);
    const token = await this.authService.generateJWT(
      organization,
      UserTypes.organization,
    );
    organization.token = token;
    if (!organization.isVerified) {
      const { id, ...dataWithoutId } = organization;
      let inviteDetails: { name?: string; address?: string } | null = null;

      try {
        const invite = await this.commonDbService.findInvite({
          assignedTo: organization.phoneNumber,
        });
        const { id: inviteId, ...inviteDataWithoutId } = invite;
        if (!invite.isUsed) {
          await this.commonDbService.updateInvite(
            { ...inviteDataWithoutId, isUsed: true },
            {
              id: inviteId,
            },
          );
        }
        const parentOrganization = await this.getParentOrganization(invite);
        inviteDetails = {
          ...(parentOrganization?.name
            ? { name: parentOrganization.name }
            : {}),
          ...(invite.location ? { address: invite.location } : {}),
        };
      } catch {
        inviteDetails = null;
      }

      await this.organizationPrismaHelperService.updateOrganization(
        {
          ...dataWithoutId,
          ...(inviteDetails ?? {}),
          isVerified: true,
        },
        {
          id,
        },
      );
    }

    let organizationToSend = organization;
    if (organization.role === OrganizationRoles.ADMIN) {
      organizationToSend = { ...organization, orgAdminId: organization.id };
    }
    const metaFlags =
      await this.organizationPrismaHelperService.findMetaFlagsForOrganization({
        organizationId: organization.id,
      });
    return { organization: organizationToSend, metaFlags };
  }

  async getParentOrganization(invite: Invite) {
    if (invite.role === OrganizationRoles.SHOP) {
      return await this.organizationPrismaHelperService.findOrganization({
        id: invite.orgAdminId,
      });
    }
    return null;
  }

  async getOrganization(id: string): Promise<Organization | null> {
    const organization =
      await this.organizationPrismaHelperService.findOrganization({
        id,
      });
    return organization;
  }

  async getOrganizationAndMetaFlags(id: string) {
    const organization =
      await this.organizationPrismaHelperService.findOrganization({
        id,
      });
    const metaFlags =
      await this.organizationPrismaHelperService.findMetaFlagsForOrganization({
        organizationId: organization.id,
      });
    return { organization, metaFlags };
  }

  async findCurrencyBucket(organizationId: string, currencyCode: string) {
    return await this.organizationPrismaHelperService.findCurrencyBucket({
      organization_id_currency_code: { organizationId, code: currencyCode },
    });
  }

  async someFunctionThatMyUpdateOrganizationEndPointWillCall(
    organizationId: string,
    form: UpdateOrganizationForm,
  ) {
    const { base64Logo, base64Cover, ...restOfTheForm } = form;
    const organization = await this.getOrganization(organizationId);
    let logoUrl = organization.logoUrl;
    let coverUrl = organization.coverUrl;
    if (base64Logo) {
      logoUrl = await this.imgbbService.uploadImage(base64Logo, 'logo');
    }
    if (base64Cover) {
      coverUrl = await this.imgbbService.uploadImage(base64Cover, 'cover');
    }
    const newOrganization = await this.updateOrganization({
      ...organization,
      ...restOfTheForm,
      ...(base64Logo && { logoUrl }),
      ...(base64Cover && { coverUrl }),
    });
    return newOrganization;
  }
  async updateOrganization(
    newOrganization: Organization,
  ): Promise<Organization> {
    const { id, ...restOfTheOrganization } = newOrganization;
    const organization =
      await this.organizationPrismaHelperService.updateOrganization(
        restOfTheOrganization,
        { id },
      );
    return organization;
  }

  async initNewCurrency(
    currencyBucket: { code: string },
    organizationId: string,
  ) {
    const { currencyBuckets, currencies } =
      await this.organizationPrismaHelperService.getOrganizationAndItsManyRelations(
        {
          id: organizationId,
        },
      );
    const doesSameCurrencyExists = currencies.find((element) => {
      return element.code === currencyBucket.code;
    });

    if (!doesSameCurrencyExists) {
      throw new CurrencyDoesNotExistsForThisOrganizationException();
    }
    const doesSameCurrencyBucketAlreadyExist = currencyBuckets.find(
      (element) => {
        return element.code === currencyBucket.code;
      },
    );
    if (!!doesSameCurrencyBucketAlreadyExist) {
      throw new CurrencyBucketAlreadyInitialiedForThisOrganizationException();
    }

    if (!!doesSameCurrencyBucketAlreadyExist) {
      throw new CurrencyBucketAlreadyInitialiedForThisOrganizationException();
    }

    await this.organizationPrismaHelperService.createOrganizationCurrencyBucket(
      {
        code: currencyBucket.code,
        organization: { connect: { id: organizationId } },
      },
    );
  }

  async logoutOrganization(organizationId: string) {
    try {
      // Find the organization by ID
      const organization =
        await this.organizationPrismaHelperService.findOrganization({
          id: organizationId,
        });

      // Update the organization document in the database
      await this.updateOrganization({ ...organization, token: '' });

      return { success: true, message: 'Token removed successfully' };
    } catch (error) {
      // Handle errors
      console.error('Error logging out organization:', error);
      return { success: false, message: 'Failed to logout organization' };
    }
  }

  async sendInterest(form: SendInterestForm) {
    await this.commonDbService.createInterest({
      phoneNumber: form.phoneNumber,
    });
  }

  async inviteShop(form: InviteShopForm, orgId: string) {
    return await this.commonDbService.createInvite({
      assignedTo: form.phoneNumber,
      location: form.location,
      role: OrganizationRoles.SHOP,
      orgAdminId: orgId,
      generatedBy: orgId,
    });
  }

  async getInvitedShops(orgId: string) {
    return await this.commonDbService.findManyInvites({
      orgAdminId: orgId,
      role: OrganizationRoles.SHOP,
    });
  }

  async getInvitedShopsAsOrganizationData(orgId: string) {
    return await this.organizationPrismaHelperService.getOrganizationsOfAnAdmin(
      {
        orgAdminId: orgId,
        role: OrganizationRoles.SHOP,
      },
    );
  }

  async getYourAdmin(adminOrgId: string, shopOrgId: string) {
    const shopOrg = await this.organizationPrismaHelperService.findOrganization(
      {
        id: shopOrgId,
      },
    );
    if (shopOrg.orgAdminId !== adminOrgId) {
      throw new InvalidAdminOrganizationException();
    }
    const adminOrg =
      await this.organizationPrismaHelperService.findOrganization({
        id: adminOrgId,
      });
    return adminOrg;
  }

  async updateFcmToken(fcmToken: string, orgId: string) {
    const organization = await this.getOrganization(orgId);
    return this.updateOrganization({ ...organization, fcmToken });
  }
  async getTopOrganizationsForLeaderBoard(paginationQuery: PaginationQueryDto) {
    const res =
      await this.organizationPrismaHelperService.getTopOrganizationsForLeaderBoard(
        paginationQuery,
      );
    return res;
  }
  async getTopOrganizationDetailForLeaderBoard(
    customerId: string,
    orgAdminId: string,
  ) {
    const { aboutUs, logoUrl, coverUrl, role } =
      await this.prismaService.organization.findFirst({
        where: { id: orgAdminId },
      });
    const orgCurrencies = await this.prismaService.currency.findMany({
      where: { organizationId: orgAdminId },
    });
    const customerWallets = await this.prismaService.customerWallet.findMany({
      where: {
        currencyCode: {
          in: orgCurrencies.map((currency) => {
            return currency.code;
          }),
        },
        customerId,
      },
    });
    const totalCashbackData = customerWallets.reduce(
      (acc, item) => {
        return {
          totalEarned:
            acc.totalAvailable +
            item.availableBalance +
            item.blockedBalance +
            item.expiredBalance +
            item.usedBalance,
          totalSpent: acc.totalSpent + item.usedBalance,
          totalAvailable: acc.totalAvailable + item.availableBalance,
        };
      },
      { totalSpent: 0, totalAvailable: 0, totalEarned: 0 },
    );
    const shops = await this.prismaService.organization.findMany({
      where: {
        orgAdminId,
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        address: true,
        upiURI: true,
        aboutUs: true,
        contactUs: true,
        operationalHours: true,
      },
    });
    if (shops.length > 1) {
    }
    return {
      logoUrl,
      coverUrl,
      aboutUs,
      totalCashbackData,
      shops:
        shops.length > 1
          ? shops.filter((shop) => shop.id !== orgAdminId)
          : shops,
    };
    // if the shops are there, so we will show just the shops, no admin, if only admin is there, we will show it
  }
}
