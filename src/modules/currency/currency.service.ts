import { Injectable } from '@nestjs/common';
import {
  OrganizationOrderStatus,
  OrganizationOrderType,
  OrganizationRoles,
  Prisma,
} from '@prisma/client';
import {
  CreateCurrencyForm,
  CreateOrgnizationCurrencyBucketForm,
  UpdateCurrencyBucketPropertiesForm,
} from './DTO/currency.dto';
import { CurrencyPrismaHelperService } from './currency-prisma-helper.service';
import to from 'await-to-js';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationOrderService } from '../organization-order/organization-order.service';
import { PrismaService } from 'src/common/services/prismaService';
import { CurrencyJobProducer } from './jobs/producer';
import { NotAuthorisedToCreateCurrencyException } from './exceptions/currency.exception';

@Injectable()
export class CurrencyService {
  constructor(
    private readonly currencyPrismaHelperService: CurrencyPrismaHelperService,
    private readonly currencyJobProducer: CurrencyJobProducer,
    private readonly organizationService: OrganizationService,
    private readonly organizationOrderService: OrganizationOrderService,
    private readonly prisma: PrismaService,
  ) {}
  async createCurrency(organizationId: string, form: CreateCurrencyForm) {
    const createCurrencyPayload: Prisma.CurrencyCreateInput = {
      name: form.name,
      code: form.currencyCode,
      organization: { connect: { id: organizationId } },
    };
    const organization = await this.organizationService.getOrganization(
      organizationId,
    );
    if (organization.role !== 'ADMIN') {
      throw new NotAuthorisedToCreateCurrencyException();
    }
    const newCurrency = await this.currencyPrismaHelperService.createCurrency({
      ...createCurrencyPayload,
      exchangeRates: {
        create: [
          {
            ...this.getExchangeRatesForThisCurrency({
              currencyCode: form.currencyCode,
            }),
          },
        ],
      },
    });
    const metaFlags = await this.prisma.metaFlagsForOrganization.findUnique({
      where: { organizationId },
      select: { firstCurrencyAdded: true },
    });

    if (!metaFlags?.firstCurrencyAdded) {
      await this.prisma.metaFlagsForOrganization.update({
        where: { organizationId },
        data: { firstCurrencyAdded: true },
      });
    }
    await this.organizationService.initNewCurrency(
      { code: form.currencyCode },
      organizationId,
    );
    return newCurrency;
  }
  getExchangeRatesForThisCurrency({ currencyCode }) {
    return { physicalCurrencyCode: 'INR', rate: 1 };
    //todo: Build the logic later:
  }
  async getCurrencyByCode(code: string) {
    return await this.currencyPrismaHelperService.findCurrencies({ code });
  }

  async searchNonOrgCurrencies(
    subStringCurrencyCode: string,
    organizationId: string,
  ) {
    const [error, existingCurrencies] = await to(
      this.currencyPrismaHelperService.findCurrencies({
        code: {
          contains: subStringCurrencyCode,
        },
        organizationId: {
          not: organizationId,
        },
      }),
    );
    let currencies = existingCurrencies;
    if (error) {
      currencies = [];
    }
    const organization =
      await this.organizationService.getOrganizationWithCurrenciesAndCurrencyBuckets(
        organizationId,
      );
    const filteredOutCurrenciesWhichAreOrgDoesNotHave = currencies.filter(
      (currency) => {
        // Check if the organization already has the currency in its currencyBuckets
        const isCurrencyInOrganization = organization.currencyBuckets.some(
          (orgCurrency) => {
            return orgCurrency.code === currency.code; // Assuming each currency has a single currencyBucket
          },
        );

        return !isCurrencyInOrganization;
      },
    );
    return filteredOutCurrenciesWhichAreOrgDoesNotHave;
  }

  async getOrgDataForCustomer(organizationId: string, customerId: string) {
    const organization = await this.organizationService.getOrganization(
      organizationId,
    );
    const currencies = await this.searchOrgCurrencies(
      organization.role === OrganizationRoles.ADMIN
        ? organizationId
        : organization.orgAdminId,
    );

    // Extract currency codes from the organization's currencies
    const currencyCodes = currencies.map((currency) => currency.code);

    // Fetch customer wallets for the relevant currencies
    const customerWallets = await this.prisma.customerWallet.findMany({
      where: {
        customerId: customerId,
        currencyCode: {
          in: currencyCodes,
        },
      },
      select: {
        currencyCode: true,
        availableBalance: true,
      },
    });

    // Create a map for quick lookup of balances by currency code
    const walletBalanceMap = new Map<string, number>();
    customerWallets.forEach((wallet) => {
      walletBalanceMap.set(wallet.currencyCode, wallet.availableBalance);
    });

    // Build the array with currency codes and corresponding balances
    const currenciesWithBalance = currencies.map((currency) => ({
      currencyCode: currency.code,
      availableAmountOfThatCurrencyForThisCustomer:
        walletBalanceMap.get(currency.code) || 0,
    }));

    return {
      name: organization.name ?? 'Fruity Bear',
      currenciesThatOrgAcceptWithCustomerAvailableBalanceForThatCurrency:
        currenciesWithBalance,
      ...(organization.upiURI && {
        upiURI: organization.upiURI,
      }),
      ...(organization.logoUrl && {
        orgLogoUrl: organization.logoUrl,
      }),
    };
  }

  async searchOrgCurrencies(organizationId: string) {
    const [error, existingCurrencies] = await to(
      this.currencyPrismaHelperService.findCurrencies({
        organizationId,
      }),
    );
    let currencies = existingCurrencies;
    if (error) {
      currencies = [];
    }
    return currencies;
  }

  async createOrganizationCurrencyBucket(
    organizationId: string,
    form: CreateOrgnizationCurrencyBucketForm,
  ) {
    this.currencyJobProducer.addNewCurrencyBucketToOrg({
      currencyBucket: { code: form.currencyCode },
      organizationId: organizationId,
    });
  }

  async getOrganizationCurrencyBuckets(orgId: string) {
    return await this.currencyPrismaHelperService.findCurrencyBuckets({
      organizationId: orgId,
    });
  }

  async addBalanceToOrganizationCurrencyBucket(
    organizationId: string,
    currencyCode: string,
    amountToAdd: number,
  ) {
    return this.prisma.$transaction(async (prismaTransaction) => {
      // Create organization order with prismaTransaction
      const organizationOrder =
        await this.organizationOrderService.createOrganizationOrder(
          organizationId,
          {
            amount: amountToAdd,
            orderType: OrganizationOrderType.CURRENCY_PURCHASE,
            details: { currencyCode },
          },
          prismaTransaction, // Pass prismaTransaction to the function
        );

      // Update the organization's currency bucket with prismaTransaction
      const updatedOrganization =
        await this.currencyPrismaHelperService.updateOrganizationCurrencyBucketAndReturnOrganization(
          organizationId,
          currencyCode,
          amountToAdd,
          prismaTransaction, // Pass prismaTransaction to the function
        );

      const metaFlags = await this.prisma.metaFlagsForOrganization.findUnique({
        where: { organizationId },
        select: { firstCurrencyBalanceAdded: true },
      });

      if (!metaFlags?.firstCurrencyBalanceAdded) {
        await this.prisma.metaFlagsForOrganization.update({
          where: { organizationId },
          data: { firstCurrencyBalanceAdded: true },
        });
      }

      // Update the organization order status to COMPLETED with prismaTransaction
      await this.organizationOrderService.updateOrganizationOrder(
        organizationOrder.id,
        {
          newStatus: OrganizationOrderStatus.COMPLETED,
        },
        prismaTransaction, // Pass prismaTransaction to the function
      );

      return updatedOrganization;
    });
  }

  async updateOrganizationCurrencyBucketProperties(
    form: UpdateCurrencyBucketPropertiesForm,
  ) {
    return await this.currencyPrismaHelperService.updateOrganizationCurrencyBucket(
      form.id,
      form.autoTopUpEnabled,
      form.autoTopUpAmount,
      form.autoTopUpThreshold,
    );
  }

  async autoTopUpCurrencyBucket(
    currencyBucketId: string,
    organizationId: string,
    amountToAdd: number,
  ) {
    return this.prisma.$transaction(async (prismaTransaction) => {
      const currencyBucket = await this.prisma.currencyBucket.findUnique({
        where: { id: currencyBucketId },
      });
      // Create organization order with prismaTransaction
      const organizationOrder =
        await this.organizationOrderService.createOrganizationOrder(
          organizationId,
          {
            amount: amountToAdd,
            orderType: OrganizationOrderType.CURRENCY_PURCHASE,
            details: { currencyCode: currencyBucket.code },
          },
          prismaTransaction, // Pass prismaTransaction to the function
        );

      // Update the organization's currency bucket with prismaTransaction
      const updatedOrganization =
        await this.currencyPrismaHelperService.updateOrganizationCurrencyBucketAndReturnOrganization(
          organizationId,
          currencyBucket.code,
          amountToAdd,
          prismaTransaction, // Pass prismaTransaction to the function
        );

      const metaFlags = await this.prisma.metaFlagsForOrganization.findUnique({
        where: { organizationId },
        select: { firstCurrencyBalanceAdded: true },
      });

      if (!metaFlags?.firstCurrencyBalanceAdded) {
        await this.prisma.metaFlagsForOrganization.update({
          where: { organizationId },
          data: { firstCurrencyBalanceAdded: true },
        });
      }

      // Update the organization order status to COMPLETED with prismaTransaction
      await this.organizationOrderService.updateOrganizationOrder(
        organizationOrder.id,
        {
          newStatus: OrganizationOrderStatus.COMPLETED,
        },
        prismaTransaction, // Pass prismaTransaction to the function
      );

      return updatedOrganization;
    });
  }

  async filterOrgCreatedCurrencies(
    organizationId: string,
    currencyCodes: string[],
  ) {
    const allOrganizationOwnedCurrencies =
      await this.currencyPrismaHelperService.findCurrencies({ organizationId });
    const onlyOrganizationOwnedCurrenciesInTheProvidedCurrencyCodes =
      currencyCodes.filter((currencyCode) => {
        for (let i = 0; i < allOrganizationOwnedCurrencies.length; i++) {
          if (currencyCode === allOrganizationOwnedCurrencies[i].code) {
            return true;
          }
        }
        return false;
      });
    return onlyOrganizationOwnedCurrenciesInTheProvidedCurrencyCodes;
  }
}
