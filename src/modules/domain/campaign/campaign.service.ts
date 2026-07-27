import { Injectable } from '@nestjs/common';
import { OrganizationCampaign } from '@prisma/client';
import {
  CurrencyBucketNotFoundException,
  InvalidCurrencyException,
} from '../currency/exceptions/currency.exception';
import { InvalidOrganizationException } from '../organization/exceptions/organization.exception';
import { OrganizationService } from '../organization/organization.service';
import {
  CreateOrEditOrganizationCampaignForm,
  EarningsPerCampaign,
  PotentialEarningForm,
} from './DTO/campaign.dto';
import {
  NotAuthorisedToCreateCampaignException,
  NotEnoughCurrencyWalletBalanceException,
  OverlappingCampaignsNotAllowedException,
} from './exceptions/campaign.exception';
import { ConfigService } from '@nestjs/config';
import { envEnums } from 'src/config/enums';
import { CampaignPrismaHelperService } from './campaign-prisma-helper.service';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { PrismaService } from 'src/common/services/prismaService';

@Injectable()
export class CampaignService {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly commonUtilsService: CommonUtilsService,
    private readonly configService: ConfigService,
    private readonly campaignPrismaHelperService: CampaignPrismaHelperService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Checks if campaign dates overlap with existing campaigns
   */
  private checkCampaignDateOverlap(
    startDate: Date,
    endDate: Date,
    existingCampaigns: OrganizationCampaign[],
    excludeCampaignId?: string,
  ): { isOverlapping: boolean; overlappingCampaignName?: string } {
    // Filter out the campaign to exclude if an ID is provided
    const campaignsToCheck = excludeCampaignId
      ? existingCampaigns.filter(
          (campaign) => campaign.id !== excludeCampaignId,
        )
      : existingCampaigns;

    // If there are no campaigns to check against, return false immediately
    if (!campaignsToCheck || campaignsToCheck.length === 0) {
      return { isOverlapping: false };
    }

    // Check for overlap with any of the existing campaigns
    for (const existingCampaign of campaignsToCheck) {
      // Get dates from existing campaign (already in UTC)
      const existingStartDate = new Date(existingCampaign.startDate);
      const existingEndDate = new Date(existingCampaign.endDate);

      // Check for overlap at the exact minute level
      // Two date ranges overlap if one range's start date is before or equal to the other range's end date
      // AND one range's end date is after or equal to the other range's start date
      const isOverlapping =
        startDate <= existingEndDate && endDate >= existingStartDate;

      // If overlapping with any campaign, return true immediately with campaign name
      if (isOverlapping) {
        return {
          isOverlapping: true,
          overlappingCampaignName: existingCampaign.name,
        };
      }
    }

    // No overlap with any campaign, return false
    return { isOverlapping: false };
  }

  /**
   * Checks if organization has sufficient currency balance for campaigns
   */
  async doesOrgHaveCurrencyToDistribute(
    organizationId: string,
    currencyCode: string,
  ): Promise<boolean> {
    const currencyBucket = await this.organizationService.findCurrencyBucket(
      organizationId,
      currencyCode,
    );
    return (
      currencyBucket.availableAmount >=
      this.configService.get(envEnums.MINIMUM_CAMPAIGN_AMOUNT_IN_INR)
    );
  }

  /**
   * Validates if the currency is valid for the organization
   */
  async isCurrencyValidForThisOrganization(
    organizationId: string,
    currencyCode: string,
  ): Promise<void> {
    const organization =
      await this.organizationService.getOrganizationWithCurrenciesAndCurrencyBuckets(
        organizationId,
      );

    if (!organization) {
      throw new InvalidOrganizationException();
    }
    // Check if the currency exists
    const currency = organization.currencies.find((bucket) => {
      return bucket.code === currencyCode;
    });

    if (!currency) {
      throw new InvalidCurrencyException();
    }

    // Check if the currency is part of the organization's currencyBuckets
    const currencyBucket = organization.currencyBuckets.find(
      (bucket) => bucket.code === currencyCode,
    );
    if (!currencyBucket) {
      throw new CurrencyBucketNotFoundException();
    }

    // If all checks pass, the currency is valid for the organization
  }

  /**
   * Creates an organization level campaign
   */
  async createOrganizationLevelCampaign(
    form: CreateOrEditOrganizationCampaignForm,
    organizationId: string,
  ): Promise<OrganizationCampaign> {
    const organization = await this.organizationService.getOrganization(
      organizationId,
    );
    if (organization.role !== 'ADMIN') {
      throw new NotAuthorisedToCreateCampaignException();
    }
    await this.isCurrencyValidForThisOrganization(
      organizationId,
      form.currencyCode,
    );

    const { force: isForceUpdate, ...campaignDetails } = form;
    const orgCampaigns = await this.getOrganizationLevelNonDeletedCampaigns(
      organizationId,
    );

    const { isOverlapping, overlappingCampaignName } =
      this.checkCampaignDateOverlap(form.startDate, form.endDate, orgCampaigns);

    // If there's an overlap and force update is not enabled, throw exception
    if (isOverlapping && !isForceUpdate) {
      throw new OverlappingCampaignsNotAllowedException(
        overlappingCampaignName,
      );
    }

    const hasSufficientFunds: boolean =
      await this.doesOrgHaveCurrencyToDistribute(
        organizationId,
        form.currencyCode,
      );

    if (!hasSufficientFunds) {
      throw new NotEnoughCurrencyWalletBalanceException(
        this.configService.get(envEnums.MINIMUM_CAMPAIGN_AMOUNT_IN_INR),
      );
    }

    const newCampaign = await this.campaignPrismaHelperService.createCampaign({
      ...campaignDetails,
      organization: { connect: { id: organizationId } },
    });
    const metaFlags = await this.prisma.metaFlagsForOrganization.findUnique({
      where: { organizationId },
      select: { firstCampaignCreated: true },
    });

    if (!metaFlags?.firstCampaignCreated) {
      await this.prisma.metaFlagsForOrganization.update({
        where: { organizationId },
        data: { firstCampaignCreated: true },
      });
    }
    // Updated organization metaFlags asynchronously
    this.updateInitJourneyFlagIfNeeded(organizationId);

    return newCampaign;
  }

  /**
   * Checks if an active campaign already exists
   */
  async checkIfThisOrganizationAlreadyHasAnActiveCampaign(
    organizationId: string,
  ): Promise<OrganizationCampaign> {
    const orgCampaigns = await this.getOrganizationLevelNonDeletedCampaigns(
      organizationId,
    );
    const now = new Date();
    const activeCampaign = orgCampaigns.find((orgCampaign) => {
      return orgCampaign.startDate <= now && orgCampaign.endDate >= now;
    });

    return activeCampaign || null;
  }

  /**
   * Updates organization journey flags if needed
   */
  async updateInitJourneyFlagIfNeeded(organizationId: string): Promise<void> {
    const organization =
      await this.organizationService.getOrganizationWithCampaignsAndMetaFlags(
        organizationId,
      );
    if (
      organization.campaigns.length >= 1 &&
      !organization.metaFlags.initJourneyCompleted
    ) {
      // Update organization's initJourneyCompleted flag asynchronously
      await this.campaignPrismaHelperService.updateMetaFlagsForOrganization(
        {
          id: organization.metaFlags.id,
        },
        {
          initJourneyCompleted: true,
        },
      );
    }
  }

  /**
   * Gets all campaigns non deleted for an organization
   */
  async getOrganizationLevelNonDeletedCampaigns(
    organizationId: string,
  ): Promise<OrganizationCampaign[]> {
    return await this.campaignPrismaHelperService.getAllCampaigns({
      organizationId,
      isSoftDeleted: false,
    });
  }

  /**
   * Gets all campaigns non deleted for an organization
   */
  async getOrganizationLevelCampaigns(
    organizationId: string,
  ): Promise<OrganizationCampaign[]> {
    return await this.campaignPrismaHelperService.getAllCampaigns({
      organizationId,
    });
  }

  /**
   * Gets a specific campaign by ID for an organization
   */
  async getOrganizationLevelCampaign(
    organizationId: string,
    campaignId: string,
  ): Promise<OrganizationCampaign> {
    return await this.campaignPrismaHelperService.getCampaign({
      organizationId,
      id: campaignId,
    });
  }

  /**
   * Updates an organization level campaign
   */
  async updateOrganizationLevelCampaign(
    form: CreateOrEditOrganizationCampaignForm,
    organizationId: string,
  ): Promise<OrganizationCampaign> {
    if (form.isSoftDeleted) {
      return await this.campaignPrismaHelperService.updateCampaign(
        {
          startDate: form.startDate,
          endDate: form.endDate,
          earningPercentage: form.earningPercentage,
          currencyCode: form.currencyCode,
          earningExpiresIn: form.earningExpiresIn,
          isSoftDeleted: form.isSoftDeleted,
        },
        {
          unique_organization_campaign_name: {
            name: form.name,
            organizationId,
          },
        },
      );
    }
    // Get all organization campaigns for overlap check
    const orgCampaigns = await this.getOrganizationLevelNonDeletedCampaigns(
      organizationId,
    );

    const { isOverlapping, overlappingCampaignName } =
      this.checkCampaignDateOverlap(
        form.startDate,
        form.endDate,
        orgCampaigns,
        form.id, // Exclude the current campaign from overlap check
      );

    // If there's an overlap and force update is not enabled, throw exception
    const { force: isForceUpdate } = form;
    if (isOverlapping && !isForceUpdate) {
      throw new OverlappingCampaignsNotAllowedException(
        overlappingCampaignName,
      );
    }

    return await this.campaignPrismaHelperService.updateCampaign(
      {
        startDate: form.startDate,
        endDate: form.endDate,
        earningPercentage: form.earningPercentage,
        currencyCode: form.currencyCode,
        earningExpiresIn: form.earningExpiresIn,
        isSoftDeleted: form.isSoftDeleted,
      },
      {
        unique_organization_campaign_name: {
          name: form.name,
          organizationId,
        },
      },
    );
  }

  /**
   * Gets all active campaigns for an organization
   */
  async getActiveCampaigns(
    organizationId: string,
  ): Promise<OrganizationCampaign[]> {
    const campaigns = await this.getOrganizationLevelNonDeletedCampaigns(
      organizationId,
    );
    const now = new Date();
    return campaigns.filter((campaign) => {
      return campaign.endDate >= now && campaign.startDate <= now;
    });
  }

  /**
   * Gets the potential earnings for active campaigns of an organization
   */
  async getActiveCampaignOfOrganizationAndTheirPotentialEarning(
    form: PotentialEarningForm,
  ): Promise<EarningsPerCampaign[]> {
    const activeCampaigns: OrganizationCampaign[] =
      await this.getActiveCampaigns(form.organizationId);
    return activeCampaigns.map((campaign) => ({
      currencyCode: campaign.currencyCode,
      amount: Math.floor((form.realAmount * campaign.earningPercentage) / 100),
      earningExpiresIn: campaign.earningExpiresIn,
      organizationCampaignId: campaign.id,
      expiryDate: this.commonUtilsService.getTimeFromCampaignExpiryEnum(
        campaign.earningExpiresIn,
      ),
    }));
  }

  /**
   * Gets a campaign by its ID
   */
  async getCampaignByCampaignId(
    campaignId: string,
  ): Promise<OrganizationCampaign> {
    return await this.campaignPrismaHelperService.getCampaign({
      id: campaignId,
    });
  }
}
