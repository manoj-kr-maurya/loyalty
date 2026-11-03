import { Injectable, Logger } from '@nestjs/common';
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
import { CustomerWalletJobProducer } from './jobs/producer';
import { InsufficientCurrencyBalanceException } from './exceptions/customerWallets.exception';

/**
 * Wallet aggregate — a stateless-per-operation wrapper around a single
 * CustomerWallet row.
 *
 * Each instance owns exactly one wallet (loaded by CustomerWalletService.initialize)
 * plus its own prisma client and job producer. It holds NO shared singleton state,
 * so concurrent requests can never clobber each other (fixes C1).
 *
 * All balance-mutating operations are wrapped in a single $transaction and are
 * idempotent (fixes C6): unblock / debit / cancel on an already-processed
 * transactionRef is a no-op instead of a partial failure.
 */
@Injectable()
export class CustomerWalletAggregate {
  private readonly logger = new Logger(CustomerWalletAggregate.name);
  private wallet: CustomerWallet;

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: CustomerWalletJobProducer,
    wallet: CustomerWallet,
  ) {
    this.wallet = wallet;
  }

  private requireWallet(): CustomerWallet {
    if (!this.wallet) {
      throw new Error('Customer wallet is not initialized');
    }
    return this.wallet;
  }

  async cancelPendingPoints(params: {
    transactionRef: string;
    customerId: string;
    currencyCode: string;
  }): Promise<CustomerWalletAggregate> {
    const wallet = this.requireWallet();

    const pendingTransaction =
      await this.prisma.customerWalletPocketTransaction.findFirst({
        where: {
          customerWalletPocket: {
            customerWallet: {
              customerId: params.customerId,
              organizationId: wallet.organizationId,
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
      this.logger.warn(
        `cancelPendingPoints: no PENDING transaction for ref=${params.transactionRef} — no-op`,
      );
      return this;
    }

    const amountToCancel = this.normalizeAmount(
      pendingTransaction.amount,
      'Pending amount',
    );

    let cancelled = false;

    await this.withTransaction(async (prisma) => {
      const claimed = await prisma.customerWalletPocketTransaction.updateMany({
        where: {
          id: pendingTransaction.id,
          status: CustomerWalletPocketTransactionStatus.PENDING,
        },
        data: { status: CustomerWalletPocketTransactionStatus.CANCELLED },
      });

      if (claimed.count === 0) return;

      await prisma.customerWalletPocketTransaction.create({
        data: {
          customerWalletPocketId: pendingTransaction.customerWalletPocketId,
          amount: amountToCancel,
          status: CustomerWalletPocketTransactionStatus.CANCELLED,
          transactionRef: `CANCEL-${params.transactionRef}`,
        },
      });

      await prisma.customerWalletPocket.update({
        where: { id: pendingTransaction.customerWalletPocketId },
        data: { pendingBalance: { decrement: amountToCancel } },
      });

      const updated = await prisma.customerWallet.updateMany({
        where: { id: wallet.id, pendingBalance: { gte: amountToCancel } },
        data: { pendingBalance: { decrement: amountToCancel } },
      });
      if (updated.count === 0) {
        throw new Error('Wallet pending balance changed concurrently');
      }

      cancelled = true;
    });

    if (cancelled) {
      wallet.pendingBalance -= amountToCancel;
    }

    return this;
  }

  async blockPoints(
    form: CustomerBlockPoints,
  ): Promise<CustomerWalletAggregate> {
    const wallet = this.requireWallet();
    const amountToBlockTotal = this.normalizeAmount(
      form.amount,
      'Block amount',
    );

    return await this.prisma
      .$transaction(async (prisma) => {
        const walletUpdate = await prisma.customerWallet.updateMany({
          where: {
            id: wallet.id,
            availableBalance: { gte: amountToBlockTotal },
          },
          data: {
            availableBalance: { decrement: amountToBlockTotal },
            blockedBalance: { increment: amountToBlockTotal },
          },
        });

        if (walletUpdate.count === 0) {
          throw new InsufficientCurrencyBalanceException(
            wallet.availableBalance,
            amountToBlockTotal,
            form.currencyCode,
          );
        }

        const pockets = await prisma.customerWalletPocket.findMany({
          where: {
            customerWalletId: wallet.id,
            availableBalance: { gt: 0 },
          },
          orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
        });

        let remainingAmount = amountToBlockTotal;
        const transactionsToCreate: Prisma.CustomerWalletPocketTransactionCreateManyInput[] =
          [];

        for (const pocket of pockets) {
          const amountToBlock = Math.min(
            remainingAmount,
            pocket.availableBalance,
          );

          transactionsToCreate.push({
            customerWalletPocketId: pocket.id,
            amount: amountToBlock,
            status: CustomerWalletPocketTransactionStatus.BLOCKED,
            transactionRef: form.transactionRef,
          });

          const pocketUpdate = await prisma.customerWalletPocket.updateMany({
            where: {
              id: pocket.id,
              availableBalance: { gte: amountToBlock },
            },
            data: {
              availableBalance: { decrement: amountToBlock },
              blockedBalance: { increment: amountToBlock },
            },
          });
          if (pocketUpdate.count === 0) {
            throw new Error('Wallet pocket changed concurrently');
          }

          remainingAmount -= amountToBlock;
          if (remainingAmount <= 0) break;
        }

        if (remainingAmount > 0) {
          throw new Error('Unexpected error: Not enough balance in pockets');
        }

        await prisma.customerWalletPocketTransaction.createMany({
          data: transactionsToCreate,
        });
      })
      .then(async () => {
        wallet.availableBalance -= amountToBlockTotal;
        wallet.blockedBalance += amountToBlockTotal;

        if (form.unblockInMinutes) {
          const reversalTime = new Date(
            Date.now() + form.unblockInMinutes * 60 * 1000,
          );
          await this.producer.scheduleReversalJob({
            transactionRef: form.transactionRef,
            currencyCode: form.currencyCode,
            customerId: form.customerId,
            organizationId: wallet.organizationId,
            reversalTime,
            status: CustomerWalletPocketTransactionStatus.BLOCKED,
          });
        }

        return this;
      });
  }

  async unblockPoints(
    form: CustomerUnblockPoints,
  ): Promise<CustomerWalletAggregate> {
    const wallet = this.requireWallet();

    const blockedTransactions =
      await this.prisma.customerWalletPocketTransaction.findMany({
        where: {
          customerWalletPocket: { customerWalletId: wallet.id },
          transactionRef: form.transactionRef,
          status: CustomerWalletPocketTransactionStatus.BLOCKED,
        },
        include: { customerWalletPocket: true },
      });

    if (blockedTransactions.length === 0) {
      this.logger.warn(
        `unblockPoints: no BLOCKED transaction for ref=${form.transactionRef} — no-op`,
      );
      return this;
    }

    const claimedTransactions: typeof blockedTransactions = [];

    await this.withTransaction(async (prisma) => {
      for (const transaction of blockedTransactions) {
        const claimed = await prisma.customerWalletPocketTransaction.updateMany(
          {
            where: {
              id: transaction.id,
              status: CustomerWalletPocketTransactionStatus.BLOCKED,
            },
            data: { status: CustomerWalletPocketTransactionStatus.UNBLOCKED },
          },
        );
        if (claimed.count === 0) continue;

        claimedTransactions.push(transaction);

        await prisma.customerWalletPocket.update({
          where: { id: transaction.customerWalletPocketId },
          data: {
            availableBalance: { increment: transaction.amount },
            blockedBalance: { decrement: transaction.amount },
          },
        });
      }

      if (claimedTransactions.length === 0) return;

      const total = claimedTransactions.reduce(
        (sum, transaction) => sum + transaction.amount,
        0,
      );
      const updated = await prisma.customerWallet.updateMany({
        where: { id: wallet.id, blockedBalance: { gte: total } },
        data: {
          availableBalance: { increment: total },
          blockedBalance: { decrement: total },
        },
      });
      if (updated.count === 0) {
        throw new Error('Wallet blocked balance changed concurrently');
      }
    });

    for (const transaction of claimedTransactions) {
      wallet.availableBalance += transaction.amount;
      wallet.blockedBalance -= transaction.amount;
    }

    return this;
  }

  async debitBlockedPoints(
    form: CustomerDebitAfterBlockPoints,
  ): Promise<CustomerWalletAggregate> {
    const wallet = this.requireWallet();

    const blockedTransactions =
      await this.prisma.customerWalletPocketTransaction.findMany({
        where: {
          customerWalletPocket: { customerWalletId: wallet.id },
          transactionRef: form.transactionRef,
          status: CustomerWalletPocketTransactionStatus.BLOCKED,
        },
        include: { customerWalletPocket: true },
      });

    if (blockedTransactions.length === 0) {
      this.logger.warn(
        `debitBlockedPoints: no BLOCKED transaction for ref=${form.transactionRef} — no-op`,
      );
      return this;
    }

    const claimedTransactions: typeof blockedTransactions = [];

    await this.withTransaction(async (prisma) => {
      for (const transaction of blockedTransactions) {
        const claimed = await prisma.customerWalletPocketTransaction.updateMany(
          {
            where: {
              id: transaction.id,
              status: CustomerWalletPocketTransactionStatus.BLOCKED,
            },
            data: { status: CustomerWalletPocketTransactionStatus.DEBITED },
          },
        );
        if (claimed.count === 0) continue;

        claimedTransactions.push(transaction);

        await prisma.customerWalletPocket.update({
          where: { id: transaction.customerWalletPocketId },
          data: {
            blockedBalance: { decrement: transaction.amount },
            usedBalance: { increment: transaction.amount },
          },
        });
      }

      if (claimedTransactions.length === 0) return;

      const total = claimedTransactions.reduce(
        (sum, transaction) => sum + transaction.amount,
        0,
      );
      const updated = await prisma.customerWallet.updateMany({
        where: { id: wallet.id, blockedBalance: { gte: total } },
        data: {
          blockedBalance: { decrement: total },
          usedBalance: { increment: total },
        },
      });
      if (updated.count === 0) {
        throw new Error('Wallet blocked balance changed concurrently');
      }
    });

    for (const transaction of claimedTransactions) {
      wallet.blockedBalance -= transaction.amount;
      wallet.usedBalance += transaction.amount;
    }

    return this;
  }

  async addPendingPoints(
    form: CustomerAddPendingPoints,
  ): Promise<CustomerWalletAggregate> {
    const wallet = this.requireWallet();
    const amount = this.normalizeAmount(form.amount, 'Pending amount');

    await this.withTransaction(async (prisma) => {
      const newPocket = await prisma.customerWalletPocket.create({
        data: {
          customerWalletId: wallet.id,
          pendingBalance: amount,
        },
      });

      await prisma.customerWalletPocketTransaction.create({
        data: {
          customerWalletPocketId: newPocket.id,
          amount,
          status: CustomerWalletPocketTransactionStatus.PENDING,
          transactionRef: form.transactionRef,
        },
      });

      await prisma.customerWallet.update({
        where: { id: wallet.id },
        data: { pendingBalance: { increment: amount } },
      });
    });

    wallet.pendingBalance += amount;

    return this;
  }

  async creditPendingPoints(
    form: CustomerCreditPendingPoints,
  ): Promise<CustomerWalletAggregate> {
    const wallet = this.requireWallet();

    const pendingTransaction =
      await this.prisma.customerWalletPocketTransaction.findFirst({
        where: {
          customerWalletPocket: { customerWalletId: wallet.id },
          transactionRef: form.transactionRef,
          status: CustomerWalletPocketTransactionStatus.PENDING,
        },
        include: { customerWalletPocket: true },
      });

    if (!pendingTransaction) {
      this.logger.warn(
        `creditPendingPoints: no PENDING transaction for ref=${form.transactionRef} — no-op`,
      );
      return this;
    }

    const amountToCredit = this.normalizeAmount(
      pendingTransaction.amount,
      'Credit amount',
    );
    const expiryDate = form.expiryDate ? new Date(form.expiryDate) : null;
    if (expiryDate && Number.isNaN(expiryDate.getTime())) {
      throw new Error('expiryDate must be a valid date');
    }

    let credited = false;

    await this.withTransaction(async (prisma) => {
      const claimed = await prisma.customerWalletPocketTransaction.updateMany({
        where: {
          id: pendingTransaction.id,
          status: CustomerWalletPocketTransactionStatus.PENDING,
        },
        data: { status: CustomerWalletPocketTransactionStatus.AWARDED },
      });

      if (claimed.count === 0) return;

      await prisma.customerWalletPocketTransaction.create({
        data: {
          customerWalletPocketId: pendingTransaction.customerWalletPocketId,
          amount: amountToCredit,
          status: CustomerWalletPocketTransactionStatus.CREDITED,
          transactionRef: `CREDIT-${form.transactionRef}`,
        },
      });

      await prisma.customerWalletPocket.update({
        where: { id: pendingTransaction.customerWalletPocketId },
        data: {
          pendingBalance: { decrement: amountToCredit },
          availableBalance: { increment: amountToCredit },
          expiryDate,
        },
      });

      const updated = await prisma.customerWallet.updateMany({
        where: { id: wallet.id, pendingBalance: { gte: amountToCredit } },
        data: {
          pendingBalance: { decrement: amountToCredit },
          availableBalance: { increment: amountToCredit },
        },
      });
      if (updated.count === 0) {
        throw new Error('Wallet pending balance changed concurrently');
      }

      credited = true;
    });

    if (!credited) return this;

    wallet.pendingBalance -= amountToCredit;
    wallet.availableBalance += amountToCredit;

    if (expiryDate) {
      await this.producer.scheduleReversalJob({
        transactionRef: form.transactionRef,
        customerId: form.customerId,
        organizationId: wallet.organizationId,
        currencyCode: form.currencyCode,
        reversalTime: expiryDate,
        status: CustomerWalletPocketTransactionStatus.CREDITED,
      });
    }

    return this;
  }

  async handleCreditPointsExpiry(params: {
    transactionRef: string;
    customerId: string;
    currencyCode: string;
  }): Promise<CustomerWalletAggregate> {
    const wallet = this.requireWallet();

    const creditTransaction =
      await this.prisma.customerWalletPocketTransaction.findFirst({
        where: {
          customerWalletPocket: {
            customerWallet: {
              customerId: params.customerId,
              organizationId: wallet.organizationId,
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
      this.logger.warn(
        `handleCreditPointsExpiry: no CREDITED transaction for ref=${params.transactionRef} — no-op`,
      );
      return this;
    }

    const { customerWalletPocket } = creditTransaction;
    const amountToExpire = customerWalletPocket.availableBalance;

    if (amountToExpire <= 0) {
      return this;
    }

    let expired = false;

    await this.withTransaction(async (prisma) => {
      const claimed = await prisma.customerWalletPocketTransaction.updateMany({
        where: {
          id: creditTransaction.id,
          status: CustomerWalletPocketTransactionStatus.CREDITED,
        },
        data: { status: CustomerWalletPocketTransactionStatus.EXPIRED },
      });
      if (claimed.count === 0) return;

      const pocketUpdate = await prisma.customerWalletPocket.updateMany({
        where: {
          id: customerWalletPocket.id,
          availableBalance: { gte: amountToExpire },
        },
        data: {
          availableBalance: { decrement: amountToExpire },
          expiredBalance: { increment: amountToExpire },
        },
      });
      if (pocketUpdate.count === 0) {
        throw new Error('Wallet pocket changed concurrently');
      }

      const updated = await prisma.customerWallet.updateMany({
        where: { id: wallet.id, availableBalance: { gte: amountToExpire } },
        data: {
          availableBalance: { decrement: amountToExpire },
          expiredBalance: { increment: amountToExpire },
        },
      });
      if (updated.count === 0) {
        throw new Error('Wallet balance changed concurrently');
      }

      expired = true;
    });

    if (expired) {
      wallet.availableBalance -= amountToExpire;
      wallet.expiredBalance += amountToExpire;
    }

    return this;
  }

  /**
   * Runs work in a transaction when the injected client is the root
   * PrismaService. When the aggregate was created inside an existing
   * transaction (order creation passes the tx client), that client has no
   * `$transaction` method, so the work joins the caller's transaction.
   */
  private async withTransaction<T>(
    work: (prisma: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const client = this.prisma as unknown as {
      $transaction?: (
        fn: (tx: Prisma.TransactionClient) => Promise<T>,
      ) => Promise<T>;
    };

    if (typeof client.$transaction !== 'function') {
      return work(this.prisma as unknown as Prisma.TransactionClient);
    }

    return client.$transaction(work);
  }

  /**
   * Balances are persisted atomically by each mutation. `save()` refreshes
   * the aggregate from the database so callers can never write a stale
   * snapshot over concurrent changes.
   */
  async save(): Promise<void> {
    const wallet = this.requireWallet();
    this.wallet = await this.prisma.customerWallet.findUniqueOrThrow({
      where: { id: wallet.id },
    });
  }

  private normalizeAmount(value: number, label: string): number {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${label} must be a positive integer`);
    }
    return value;
  }
}
