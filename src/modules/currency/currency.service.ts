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
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

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
    if (!organization) {
      throw new CommonException(
        'Organization not found',
        StatusCodes.NOT_FOUND,
      );
    }
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
    if (!organization) {
      throw new CommonException(
        'Organization not found',
        StatusCodes.NOT_FOUND,
      );
    }
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
      name: organization.name ?? '',
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
    paymentReference: string,
    paymentAmount: number,
    paymentProvider?: string,
  ) {
    if (!Number.isInteger(amountToAdd) || amountToAdd <= 0) {
      throw new CommonException(
        'Currency amount must be a positive integer',
        StatusCodes.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (prismaTransaction) => {
      const existing = await prismaTransaction.organizationOrder.findUnique({
        where: { paymentReference },
        include: { details: true },
      });

      if (existing) {
        if (
          existing.organizationId !== organizationId ||
          existing.details?.currencyCode !== currencyCode ||
          existing.amount !== amountToAdd
        ) {
          throw new CommonException(
            'Payment reference has already been used',
            StatusCodes.CONFLICT,
          );
        }
        return prismaTransaction.currencyBucket.findMany({
          where: { organizationId },
        });
      }

      const { rate } = await this.getPurchaseCurrency(
        prismaTransaction,
        organizationId,
        currencyCode,
      );
      this.assertPaymentAmount(amountToAdd * rate, paymentAmount);

      const organizationOrder =
        await this.organizationOrderService.createOrganizationOrder(
          organizationId,
          {
            amount: amountToAdd,
            orderType: OrganizationOrderType.CURRENCY_PURCHASE,
            details: { currencyCode },
          },
          prismaTransaction,
        );

      return this.completeCurrencyPurchase(
        prismaTransaction,
        organizationOrder,
        currencyCode,
        amountToAdd,
        paymentReference,
        paymentAmount,
        paymentProvider,
      );
    });
  }

  async confirmCurrencyPurchase(input: {
    orderId: string;
    paymentReference: string;
    paymentAmount: number;
    paymentProvider?: string;
  }) {
    return this.prisma.$transaction(async (prismaTransaction) => {
      const order = await prismaTransaction.organizationOrder.findUnique({
        where: { id: input.orderId },
        include: { details: true },
      });

      if (!order) {
        throw new CommonException(
          `Order ${input.orderId} not found`,
          StatusCodes.NOT_FOUND,
        );
      }

      if (order.orderType !== OrganizationOrderType.CURRENCY_PURCHASE) {
        throw new CommonException(
          'Only currency purchase orders can be confirmed here',
          StatusCodes.BAD_REQUEST,
        );
      }

      if (!order.details?.currencyCode) {
        throw new CommonException(
          'Currency purchase order has no currency code',
          StatusCodes.BAD_REQUEST,
        );
      }

      if (order.orderStatus === OrganizationOrderStatus.COMPLETED) {
        if (order.paymentReference === input.paymentReference) {
          return order;
        }
        throw new CommonException(
          'Order is already completed with another payment reference',
          StatusCodes.CONFLICT,
        );
      }

      if (
        order.orderStatus !== OrganizationOrderStatus.PENDING &&
        order.orderStatus !== OrganizationOrderStatus.PROCESSING
      ) {
        throw new CommonException(
          `Order is ${order.orderStatus} and cannot be paid`,
          StatusCodes.BAD_REQUEST,
        );
      }

      const claimed = await prismaTransaction.organizationOrder.updateMany({
        where: {
          id: order.id,
          orderStatus: {
            in: [
              OrganizationOrderStatus.PENDING,
              OrganizationOrderStatus.PROCESSING,
            ],
          },
        },
        data: { orderStatus: OrganizationOrderStatus.PROCESSING },
      });

      if (claimed.count === 0) {
        const current = await prismaTransaction.organizationOrder.findUnique({
          where: { id: order.id },
        });

        if (
          current?.orderStatus === OrganizationOrderStatus.COMPLETED &&
          current.paymentReference === input.paymentReference
        ) {
          return current;
        }

        throw new CommonException(
          'Order is already being processed with another payment',
          StatusCodes.CONFLICT,
        );
      }

      const duplicate = await prismaTransaction.organizationOrder.findUnique({
        where: { paymentReference: input.paymentReference },
        select: { id: true },
      });

      if (duplicate && duplicate.id !== order.id) {
        throw new CommonException(
          'Payment reference has already been used',
          StatusCodes.CONFLICT,
        );
      }

      const { rate } = await this.getPurchaseCurrency(
        prismaTransaction,
        order.organizationId,
        order.details.currencyCode,
      );
      this.assertPaymentAmount(order.amount * rate, input.paymentAmount);

      await this.completeCurrencyPurchase(
        prismaTransaction,
        order,
        order.details.currencyCode,
        order.amount,
        input.paymentReference,
        input.paymentAmount,
        input.paymentProvider,
      );

      return prismaTransaction.organizationOrder.findUnique({
        where: { id: order.id },
        include: { details: true, statusHistory: true },
      });
    });
  }

  private async completeCurrencyPurchase(
    tx: Prisma.TransactionClient,
    order: { id: string; organizationId: string },
    currencyCode: string,
    amount: number,
    paymentReference: string,
    paymentAmount: number,
    paymentProvider?: string,
  ) {
    await tx.organizationOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: OrganizationOrderStatus.COMPLETED,
        paymentReference,
        paymentAmount,
        paymentProvider,
        paymentConfirmedAt: new Date(),
        statusHistory: {
          create: {
            status: OrganizationOrderStatus.COMPLETED,
            timestamp: new Date(),
          },
        },
      },
    });

    await tx.currencyBucket.update({
      where: {
        organization_id_currency_code: {
          organizationId: order.organizationId,
          code: currencyCode,
        },
      },
      data: { availableAmount: { increment: amount } },
    });

    const metaFlags = await tx.metaFlagsForOrganization.findUnique({
      where: { organizationId: order.organizationId },
      select: { firstCurrencyBalanceAdded: true },
    });

    if (!metaFlags?.firstCurrencyBalanceAdded) {
      await tx.metaFlagsForOrganization.update({
        where: { organizationId: order.organizationId },
        data: { firstCurrencyBalanceAdded: true },
      });
    }

    return tx.organizationOrder.findUnique({
      where: { id: order.id },
      include: { details: true, statusHistory: true },
    });
  }

  private async getPurchaseCurrency(
    tx: Prisma.TransactionClient,
    organizationId: string,
    currencyCode: string,
  ) {
    const currency = await tx.currency.findFirst({
      where: { organizationId, code: currencyCode },
      include: {
        exchangeRates: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!currency) {
      throw new CommonException(
        `Currency ${currencyCode} not found for organization`,
        StatusCodes.NOT_FOUND,
      );
    }

    const rate = Number(currency.exchangeRates[0]?.rate ?? 1);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new CommonException(
        'Currency has no valid exchange rate',
        StatusCodes.BAD_REQUEST,
      );
    }

    return { currency, rate };
  }

  private assertPaymentAmount(expected: number, paid: number) {
    if (!Number.isFinite(paid) || paid <= 0) {
      throw new CommonException(
        'A positive paymentAmount is required',
        StatusCodes.BAD_REQUEST,
      );
    }

    if (Math.abs(expected - paid) > 0.01) {
      throw new CommonException(
        `Payment amount ${paid} does not match the expected amount ${expected.toFixed(
          2,
        )} (amount × exchange rate). Send paymentAmount ${expected.toFixed(
          2,
        )}, or change the amount/rate.`,
        StatusCodes.BAD_REQUEST,
      );
    }
  }

  async updateOrganizationCurrencyBucketProperties(
    organizationId: string,
    form: UpdateCurrencyBucketPropertiesForm,
  ) {
    const bucket = await this.prisma.currencyBucket.findFirst({
      where: { id: form.id, organizationId },
      select: { id: true },
    });

    if (!bucket) {
      throw new CommonException(
        'Currency bucket not found for organization',
        StatusCodes.NOT_FOUND,
      );
    }

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
