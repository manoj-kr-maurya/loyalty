import { Injectable } from '@nestjs/common';
import {
  CustomerWallet,
  CustomerWalletPocketTransactionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/common/services/prismaService';
import {
  CustomerAddPendingPoints,
  CustomerBlockPoints,
  CustomerCreditPendingPoints,
  CustomerDebitAfterBlockPoints,
  CustomerUnblockPoints,
} from './DTO/customerWallets.dto';
import {
  InsufficientCurrencyBalanceException,
  TransactionNotFoundException,
} from './exceptions/customerWallets.exception';
import { CustomerWalletJobProducer } from './jobs/producer';
import { getPaginationMetadata } from 'src/common/utils/pagination.util';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class CustomerWalletService {
  private customerWallet: CustomerWallet;

  constructor(
    private readonly customerWalletsQueueJobProducer: CustomerWalletJobProducer,
    private prisma: PrismaService,
  ) {}

  async initialize(
    customerId: string,
    currencyCode: string,
    prismaService?: PrismaService,
  ): Promise<CustomerWalletService> {
    if (prismaService) {
      this.prisma = prismaService;
    }

    try {
      this.customerWallet = await this.prisma.customerWallet.upsert({
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

      return this;
    } catch (error) {
      console.error('Error initializing customer wallet:', error);
      throw new Error('Failed to initialize customer wallet');
    }
  }
  async cancelPendingPoints(params: {
    transactionRef: string;
    customerId: string;
    currencyCode: string;
  }): Promise<CustomerWalletService> {
    if (!this.customerWallet) {
      throw new Error('Customer wallet is not initialized');
    }

    const pendingTransaction =
      await this.prisma.customerWalletPocketTransaction.findFirst({
        where: {
          customerWalletPocket: {
            customerWallet: {
              customerId: params.customerId,
              currencyCode: params.currencyCode,
            },
          },
          transactionRef: params.transactionRef,
          status: CustomerWalletPocketTransactionStatus.PENDING,
        },
        include: {
          customerWalletPocket: true,
        },
      });

    if (!pendingTransaction) {
      throw new TransactionNotFoundException(
        params.transactionRef,
        CustomerWalletPocketTransactionStatus.PENDING,
      );
    }

    const amountToCancel = pendingTransaction.amount;

    // Start a transaction to ensure data consistency
    await this.prisma.$transaction(async (prisma) => {
      // Update the transaction status to CANCELLED
      await prisma.customerWalletPocketTransaction.update({
        where: { id: pendingTransaction.id },
        data: { status: CustomerWalletPocketTransactionStatus.CANCELLED },
      });

      // Create a new transaction to record the cancellation
      await prisma.customerWalletPocketTransaction.create({
        data: {
          customerWalletPocketId: pendingTransaction.customerWalletPocketId,
          amount: amountToCancel,
          status: CustomerWalletPocketTransactionStatus.CANCELLED,
          transactionRef: `CANCEL-${params.transactionRef}`,
        },
      });

      // Update the wallet pocket
      await prisma.customerWalletPocket.update({
        where: { id: pendingTransaction.customerWalletPocketId },
        data: {
          pendingBalance: { decrement: amountToCancel },
        },
      });

      // Update the main wallet
      await prisma.customerWallet.update({
        where: {
          customer_id_currency_code: {
            customerId: params.customerId,
            currencyCode: params.currencyCode,
          },
        },
        data: {
          pendingBalance: { decrement: amountToCancel },
        },
      });
    });

    // Update the local customerWallet object
    if (this.customerWallet) {
      this.customerWallet.pendingBalance -= amountToCancel;
    }

    return this;
  }

  async blockPoints(form: CustomerBlockPoints): Promise<CustomerWalletService> {
    if (!this.customerWallet) {
      throw new Error('Customer wallet is not initialized');
    }

    if (form.amount > this.customerWallet.availableBalance) {
      throw new InsufficientCurrencyBalanceException(
        this.customerWallet.availableBalance,
        form.amount,
        form.currencyCode,
      );
    }

    const pockets = await this.prisma.customerWalletPocket.findMany({
      where: {
        customerWalletId: this.customerWallet.id,
        availableBalance: { gt: 0 },
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });

    let remainingAmount = form.amount;
    const transactionsToCreate: Prisma.CustomerWalletPocketTransactionCreateManyInput[] =
      [];
    const pocketUpdates: {
      [key: string]: Prisma.CustomerWalletPocketUpdateInput;
    } = {};

    for (const pocket of pockets) {
      const amountToBlock = Math.min(remainingAmount, pocket.availableBalance);

      transactionsToCreate.push({
        customerWalletPocketId: pocket.id,
        amount: amountToBlock,
        status: CustomerWalletPocketTransactionStatus.BLOCKED,
        transactionRef: form.transactionRef,
      });

      pocketUpdates[pocket.id] = {
        availableBalance: { decrement: amountToBlock },
        blockedBalance: { increment: amountToBlock },
      };

      remainingAmount -= amountToBlock;
      if (remainingAmount <= 0) break;
    }

    if (remainingAmount > 0) {
      throw new Error('Unexpected error: Not enough balance in pockets');
    }

    await this.prisma.customerWalletPocketTransaction.createMany({
      data: transactionsToCreate,
    });

    Object.keys(pocketUpdates).forEach(async (pocketUpdateKey) => {
      await this.prisma.customerWalletPocket.update({
        where: {
          id: pocketUpdateKey,
        },
        data: pocketUpdates[pocketUpdateKey],
      });
    });

    this.customerWallet.availableBalance -= form.amount;
    this.customerWallet.blockedBalance += form.amount;

    if (form.unblockInMinutes) {
      const reversalTime = new Date(
        Date.now() + form.unblockInMinutes * 60 * 1000,
      );
      this.customerWalletsQueueJobProducer.scheduleReversalJob({
        transactionRef: form.transactionRef,
        currencyCode: form.currencyCode,
        customerId: form.customerId,
        reversalTime,
        status: CustomerWalletPocketTransactionStatus.BLOCKED,
      });
    }

    return this;
  }

  async unblockPoints(
    form: CustomerUnblockPoints,
  ): Promise<CustomerWalletService> {
    if (!this.customerWallet) {
      throw new Error('Customer wallet is not initialized');
    }

    const blockedTransactions =
      await this.prisma.customerWalletPocketTransaction.findMany({
        where: {
          customerWalletPocket: { customerWalletId: this.customerWallet.id },
          transactionRef: form.transactionRef,
          status: CustomerWalletPocketTransactionStatus.BLOCKED,
        },
        include: { customerWalletPocket: true },
      });

    if (blockedTransactions.length === 0) {
      throw new TransactionNotFoundException(
        form.transactionRef,
        CustomerWalletPocketTransactionStatus.BLOCKED,
      );
    }

    for (const transaction of blockedTransactions) {
      await this.prisma.customerWalletPocketTransaction.create({
        data: {
          customerWalletPocketId: transaction.customerWalletPocketId,
          amount: transaction.amount,
          status: CustomerWalletPocketTransactionStatus.UNBLOCKED,
          transactionRef: form.transactionRef,
        },
      });

      await this.prisma.customerWalletPocket.update({
        where: { id: transaction.customerWalletPocketId },
        data: {
          availableBalance: { increment: transaction.amount },
          blockedBalance: { decrement: transaction.amount },
        },
      });

      this.customerWallet.availableBalance += transaction.amount;
      this.customerWallet.blockedBalance -= transaction.amount;
    }

    return this;
  }

  async debitBlockedPoints(
    form: CustomerDebitAfterBlockPoints,
  ): Promise<CustomerWalletService> {
    if (!this.customerWallet) {
      throw new Error('Customer wallet is not initialized');
    }

    const blockedTransactions =
      await this.prisma.customerWalletPocketTransaction.findMany({
        where: {
          customerWalletPocket: { customerWalletId: this.customerWallet.id },
          transactionRef: form.transactionRef,
          status: CustomerWalletPocketTransactionStatus.BLOCKED,
        },
        include: { customerWalletPocket: true },
      });

    if (blockedTransactions.length === 0) {
      throw new TransactionNotFoundException(
        form.transactionRef,
        CustomerWalletPocketTransactionStatus.BLOCKED,
      );
    }

    for (const transaction of blockedTransactions) {
      await this.prisma.customerWalletPocketTransaction.create({
        data: {
          customerWalletPocketId: transaction.customerWalletPocketId,
          amount: transaction.amount,
          status: CustomerWalletPocketTransactionStatus.DEBITED,
          transactionRef: `DEBIT-${form.transactionRef}`,
        },
      });

      await this.prisma.customerWalletPocket.update({
        where: { id: transaction.customerWalletPocketId },
        data: {
          blockedBalance: { decrement: transaction.amount },
          usedBalance: { increment: transaction.amount },
        },
      });

      this.customerWallet.blockedBalance -= transaction.amount;
      this.customerWallet.usedBalance += transaction.amount;
    }

    return this;
  }

  async addPendingPoints(
    form: CustomerAddPendingPoints,
  ): Promise<CustomerWalletService> {
    if (!this.customerWallet) {
      throw new Error('Customer wallet is not initialized');
    }

    const newPocket = await this.prisma.customerWalletPocket.create({
      data: {
        customerWalletId: this.customerWallet.id,
        pendingBalance: form.amount,
      },
    });

    await this.prisma.customerWalletPocketTransaction.create({
      data: {
        customerWalletPocketId: newPocket.id,
        amount: form.amount,
        status: CustomerWalletPocketTransactionStatus.PENDING,
        transactionRef: form.transactionRef,
      },
    });

    this.customerWallet.pendingBalance += form.amount;

    return this;
  }

  async creditPendingPoints(
    form: CustomerCreditPendingPoints,
  ): Promise<CustomerWalletService> {
    if (!this.customerWallet) {
      throw new Error('Customer wallet is not initialized');
    }

    const pendingTransaction =
      await this.prisma.customerWalletPocketTransaction.findFirst({
        where: {
          customerWalletPocket: { customerWalletId: this.customerWallet.id },
          transactionRef: form.transactionRef,
          status: CustomerWalletPocketTransactionStatus.PENDING,
        },
        include: { customerWalletPocket: true },
      });

    if (!pendingTransaction) {
      throw new TransactionNotFoundException(
        form.transactionRef,
        CustomerWalletPocketTransactionStatus.PENDING,
      );
    }
    const amountToCredit = pendingTransaction.amount;

    await this.prisma.customerWalletPocketTransaction.create({
      data: {
        customerWalletPocketId: pendingTransaction.customerWalletPocketId,
        amount: amountToCredit,
        status: CustomerWalletPocketTransactionStatus.CREDITED,
        transactionRef: `CREDIT-${form.transactionRef}`,
      },
    });

    await this.prisma.customerWalletPocketTransaction.update({
      where: { id: pendingTransaction.id },
      data: { status: CustomerWalletPocketTransactionStatus.AWARDED },
    });

    await this.prisma.customerWalletPocket.update({
      where: { id: pendingTransaction.customerWalletPocketId },
      data: {
        pendingBalance: { decrement: amountToCredit },
        availableBalance: { increment: amountToCredit },
        expiryDate: new Date(form.expiryDate),
      },
    });

    this.customerWallet.pendingBalance -= amountToCredit;
    this.customerWallet.availableBalance += amountToCredit;
    this.customerWalletsQueueJobProducer.scheduleReversalJob({
      transactionRef: form.transactionRef,
      customerId: form.customerId,
      currencyCode: form.currencyCode,
      reversalTime: new Date(form.expiryDate),
      status: CustomerWalletPocketTransactionStatus.CREDITED,
    });

    return this;
  }

  async handleCreditPointsExpiry(params: {
    transactionRef: string;
    customerId: string;
    currencyCode: string;
  }): Promise<CustomerWalletService> {
    if (!this.customerWallet) {
      throw new Error('Customer wallet is not initialized');
    }

    // Find the specific credited transaction
    const creditTransaction =
      await this.prisma.customerWalletPocketTransaction.findFirst({
        where: {
          customerWalletPocket: {
            customerWallet: {
              customerId: params.customerId,
              currencyCode: params.currencyCode,
            },
          },
          transactionRef: `CREDIT-${params.transactionRef}`,
          status: CustomerWalletPocketTransactionStatus.CREDITED,
        },
        include: {
          customerWalletPocket: {
            include: { customerWallet: true },
          },
        },
      });

    if (!creditTransaction) {
      throw new TransactionNotFoundException(
        params.transactionRef,
        CustomerWalletPocketTransactionStatus.CREDITED,
      );
    }

    const { customerWalletPocket } = creditTransaction;
    const amountToExpire = Math.max(
      customerWalletPocket.availableBalance - customerWalletPocket.usedBalance,
      0,
    );

    try {
      // Start a transaction to ensure data consistency
      await this.prisma.$transaction(async (prisma) => {
        // Update the transaction status to EXPIRED
        await prisma.customerWalletPocketTransaction.update({
          where: { id: creditTransaction.id },
          data: { status: CustomerWalletPocketTransactionStatus.EXPIRED },
        });

        // Update the wallet pocket
        await prisma.customerWalletPocket.update({
          where: { id: customerWalletPocket.id },
          data: {
            availableBalance: { decrement: amountToExpire },
            expiredBalance: { increment: amountToExpire },
          },
        });

        // Update the main wallet
        await prisma.customerWallet.update({
          where: { id: customerWalletPocket.customerWallet.id },
          data: {
            availableBalance: { decrement: amountToExpire },
            expiredBalance: { increment: amountToExpire },
          },
        });
      });
    } catch (error) {
      throw error;
    }

    // Update the local customerWallet object
    if (this.customerWallet) {
      this.customerWallet.availableBalance -= amountToExpire;
      this.customerWallet.expiredBalance += amountToExpire;
    }

    // No need to add a reversal job since we've already processed the expiry
    return this;
  }

  async save(): Promise<void> {
    if (!this.customerWallet) {
      throw new Error('Customer wallet is not initialized');
    }

    try {
      await this.prisma.customerWallet.update({
        where: { id: this.customerWallet.id },
        data: {
          availableBalance: this.customerWallet.availableBalance,
          blockedBalance: this.customerWallet.blockedBalance,
          pendingBalance: this.customerWallet.pendingBalance,
          usedBalance: this.customerWallet.usedBalance,
          expiredBalance: this.customerWallet.expiredBalance,
        },
      });
    } catch (error) {
      console.error('Error saving customer wallet:', error);
      throw new Error('Failed to save customer wallet');
    }
  }

  async fetchCustomerWallets(customerId: string, query: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    // Build base where clause
    const where: Prisma.CustomerWalletWhereInput = {
      customerId,
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
    currencyWalletId: string,
    query: PaginationQueryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

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
          id: currencyWalletId,
        },
      }),
    ]);

    const metadata = getPaginationMetadata(totalItems, page, limit);

    return {
      pockets,
      metadata,
    };
  }

  async fetchBroadCustomerBalance(customerId: string) {
    // Fetch all wallets for the customer with required balances
    const wallets = await this.prisma.customerWallet.findMany({
      where: { customerId },
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
