import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/services/prismaService';
import { CustomerWalletAggregate } from './customer-wallet-aggregate';
import { CustomerWalletJobProducer } from './jobs/producer';
import { getPaginationMetadata } from 'src/common/utils/pagination.util';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

/**
 * CustomerWalletService — stateless read service + factory for wallet aggregates.
 *
 * All balance-mutating operations are performed on a CustomerWalletAggregate
 * (created via initialize), so this singleton never holds per-request state.
 * This removes the concurrency hazard where concurrent requests clobbered a
 * shared this.customerWallet / this.prisma (fixes C1).
 */
@Injectable()
export class CustomerWalletService {
  constructor(
    private readonly customerWalletsQueueJobProducer: CustomerWalletJobProducer,
    private prisma: PrismaService,
  ) {}

  async initialize(
    customerId: string,
    currencyCode: string,
    prismaService?: PrismaService,
  ): Promise<CustomerWalletAggregate> {
    const prisma = prismaService ?? this.prisma;

    const wallet = await prisma.customerWallet.upsert({
      where: {
        customer_id_currency_code: { customerId, currencyCode },
      },
      update: {}, // No updates if the wallet exists
      create: {
        customerId,
        currencyCode,
        availableBalance: 0,
        blockedBalance: 0,
        pendingBalance: 0,
        usedBalance: 0,
        expiredBalance: 0,
      },
    });

    return new CustomerWalletAggregate(prisma, this.customerWalletsQueueJobProducer, wallet);
  }

  async fetchCustomerWallets(
    customerId: string,
    organizationId: string,
    query: PaginationQueryDto,
  ) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const orgCurrencies = await this.prisma.currency.findMany({
      where: { organizationId },
      select: { code: true },
    });
    const orgCurrencyCodes = orgCurrencies.map((currency) => currency.code);

    // Build base where clause
    const where: Prisma.CustomerWalletWhereInput = {
      customerId,
      currencyCode: { in: orgCurrencyCodes },
      availableBalance: { gt: 0 },
    };

    // Get wallets with pagination in a single query
    const [wallets, totalItems] = await Promise.all([
      this.prisma.customerWallet.findMany({
        where,
        include: {
          pockets: {
            include: {
              transactions: {
                orderBy: { createdAt: 'desc' },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerWallet.count({
        where,
      }),
    ]);

    // If there's a search term, we'll filter currencies and organizations
    const currencyCodes = [...new Set(wallets.map((w) => w.currencyCode))];
    const currencies = await this.prisma.currency.findMany({
      where: {
        code: { in: currencyCodes },
        ...(search && {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            {
              organization: { name: { contains: search, mode: 'insensitive' } },
            },
          ],
        }),
      },
      include: {
        organization: {
          select: {
            name: true,
            logoUrl: true,
          },
        },
      },
    });

    // Create a currency-to-organization map
    const currencyOrgMap = new Map(
      currencies.map((c) => [
        c.code,
        c.organization
          ? {
              name: c.organization.name,
              logoUrl: c.organization.logoUrl,
            }
          : null,
      ]),
    );

    // Filter wallets based on search if provided
    let filteredWallets = wallets;
    if (search) {
      filteredWallets = wallets.filter(
        (wallet) =>
          currencyOrgMap.has(wallet.currencyCode) &&
          (wallet.currencyCode.toLowerCase().includes(search.toLowerCase()) ||
            currencyOrgMap
              .get(wallet.currencyCode)
              ?.name.toLowerCase()
              .includes(search.toLowerCase())),
      );
    }

    // Map wallets with orgInfo in memory
    const walletsWithOrgInfo = filteredWallets.map((wallet) => ({
      ...wallet,
      orgInfo: currencyOrgMap.get(wallet.currencyCode) || null,
    }));

    const metadata = getPaginationMetadata(
      search ? filteredWallets.length : totalItems,
      page,
      limit,
    );

    return {
      wallets: walletsWithOrgInfo,
      metadata,
    };
  }

  async fetchCurrencyWalletPockets(
    customerId: string,
    organizationId: string,
    currencyWalletId: string,
    query: PaginationQueryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const orgCurrencies = await this.prisma.currency.findMany({
      where: { organizationId },
      select: { code: true },
    });
    const wallet = await this.prisma.customerWallet.findFirst({
      where: {
        id: currencyWalletId,
        customerId,
        currencyCode: { in: orgCurrencies.map((currency) => currency.code) },
      },
      select: { id: true },
    });

    if (!wallet) {
      throw new CommonException(
        'Wallet not found for customer',
        StatusCodes.NOT_FOUND,
      );
    }

    const [pockets, totalItems] = await Promise.all([
      this.prisma.customerWalletPocket.findMany({
        where: {
          customerWalletId: currencyWalletId,
          availableBalance: { gt: 0 },
        },

        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.customerWalletPocket.count({
        where: {
          customerWalletId: currencyWalletId,
          availableBalance: { gt: 0 },
        },
      }),
    ]);

    const metadata = getPaginationMetadata(totalItems, page, limit);

    return {
      pockets,
      metadata,
    };
  }

  async fetchBroadCustomerBalance(
    customerId: string,
    organizationId: string,
  ) {
    const orgCurrencies = await this.prisma.currency.findMany({
      where: { organizationId },
      select: { code: true },
    });
    const wallets = await this.prisma.customerWallet.findMany({
      where: {
        customerId,
        currencyCode: { in: orgCurrencies.map((currency) => currency.code) },
      },
      select: {
        id: true,
        currencyCode: true,
        availableBalance: true,
        blockedBalance: true,
        usedBalance: true,
        expiredBalance: true,
        pendingBalance: true,
      },
    });

    // Calculate totals using reduce for better immutability
    const totals = wallets.reduce(
      (acc, wallet) => ({
        available: acc.available + wallet.availableBalance,
        blocked: acc.blocked + wallet.blockedBalance,
        used: acc.used + wallet.usedBalance,
        expired: acc.expired + wallet.expiredBalance,
        pending: acc.pending + wallet.pendingBalance,
      }),
      {
        available: 0,
        blocked: 0,
        used: 0,
        expired: 0,
        pending: 0,
      },
    );

    return {
      totals: {
        earned:
          totals.available + totals.used + totals.expired + totals.blocked,
        available: totals.available,
        blocked: totals.blocked,
        used: totals.used,
        expired: totals.expired,
        pending: totals.pending,
      },
      wallets: wallets.map((wallet) => ({
        id: wallet.id,
        currencyCode: wallet.currencyCode,
        balances: {
          available: wallet.availableBalance,
          blocked: wallet.blockedBalance,
          used: wallet.usedBalance,
          expired: wallet.expiredBalance,
          pending: wallet.pendingBalance,
        },
      })),
    };
  }
}
