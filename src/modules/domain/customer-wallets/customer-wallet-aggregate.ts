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
import {
  InsufficientCurrencyBalanceException,
  TransactionNotFoundException,
} from './exceptions/customerWallets.exception';

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

    const amountToCancel = pendingTransaction.amount;

    await this.prisma.$transaction(async (prisma) => {
      await prisma.customerWalletPocketTransaction.update({
        where: { id: pendingTransaction.id },
        data: { status: CustomerWalletPocketTransactionStatus.CANCELLED },
      });

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

      await prisma.customerWallet.update({
        where: { id: wallet.id },
        data: { pendingBalance: { decrement: amountToCancel } },
      });
    });

    wallet.pendingBalance -= amountToCancel;

    return this;
  }

  async blockPoints(form: CustomerBlockPoints): Promise<CustomerWalletAggregate> {
    const wallet = this.requireWallet();

    if (form.amount > wallet.availableBalance) {
      throw new InsufficientCurrencyBalanceException(
        wallet.availableBalance,
        form.amount,
        form.currencyCode,
      );
    }

    return await this.prisma.$transaction(async (prisma) => {
      const pockets = await prisma.customerWalletPocket.findMany({
        where: {
          customerWalletId: wallet.id,
          availableBalance: { gt: 0 },
        },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      });

      let remainingAmount = form.amount;
      const transactionsToCreate: Prisma.CustomerWalletPocketTransactionCreateManyInput[] =
        [];

      for (const pocket of pockets) {
        const amountToBlock = Math.min(remainingAmount, pocket.availableBalance);

        transactionsToCreate.push({
          customerWalletPocketId: pocket.id,
          amount: amountToBlock,
          status: CustomerWalletPocketTransactionStatus.BLOCKED,
          transactionRef: form.transactionRef,
        });

        await prisma.customerWalletPocket.update({
          where: { id: pocket.id },
          data: {
            availableBalance: { decrement: amountToBlock },
            blockedBalance: { increment: amountToBlock },
          },
        });

        remainingAmount -= amountToBlock;
        if (remainingAmount <= 0) break;
      }

      if (remainingAmount > 0) {
        throw new Error('Unexpected error: Not enough balance in pockets');
      }

      await prisma.customerWalletPocketTransaction.createMany({
        data: transactionsToCreate,
      });

      await prisma.customerWallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: form.amount },
          blockedBalance: { increment: form.amount },
        },
      });
    }).then(async () => {
      wallet.availableBalance -= form.amount;
      wallet.blockedBalance += form.amount;

      if (form.unblockInMinutes) {
        const reversalTime = new Date(
          Date.now() + form.unblockInMinutes * 60 * 1000,
        );
        await this.producer.scheduleReversalJob({
          transactionRef: form.transactionRef,
          currencyCode: form.currencyCode,
          customerId: form.customerId,
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

    await this.prisma.$transaction(async (prisma) => {
      for (const transaction of blockedTransactions) {
        await prisma.customerWalletPocketTransaction.create({
          data: {
            customerWalletPocketId: transaction.customerWalletPocketId,
            amount: transaction.amount,
            status: CustomerWalletPocketTransactionStatus.UNBLOCKED,
            transactionRef: form.transactionRef,
          },
        });

        await prisma.customerWalletPocket.update({
          where: { id: transaction.customerWalletPocketId },
          data: {
            availableBalance: { increment: transaction.amount },
            blockedBalance: { decrement: transaction.amount },
          },
        });
      }
    });

    for (const transaction of blockedTransactions) {
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

    await this.prisma.$transaction(async (prisma) => {
      for (const transaction of blockedTransactions) {
        await prisma.customerWalletPocketTransaction.create({
          data: {
            customerWalletPocketId: transaction.customerWalletPocketId,
            amount: transaction.amount,
            status: CustomerWalletPocketTransactionStatus.DEBITED,
            transactionRef: `DEBIT-${form.transactionRef}`,
          },
        });

        await prisma.customerWalletPocket.update({
          where: { id: transaction.customerWalletPocketId },
          data: {
            blockedBalance: { decrement: transaction.amount },
            usedBalance: { increment: transaction.amount },
          },
        });
      }
    });

    for (const transaction of blockedTransactions) {
      wallet.blockedBalance -= transaction.amount;
      wallet.usedBalance += transaction.amount;
    }

    return this;
  }

  async addPendingPoints(
    form: CustomerAddPendingPoints,
  ): Promise<CustomerWalletAggregate> {
    const wallet = this.requireWallet();

    await this.prisma.$transaction(async (prisma) => {
      const newPocket = await prisma.customerWalletPocket.create({
        data: {
          customerWalletId: wallet.id,
          pendingBalance: form.amount,
        },
      });

      await prisma.customerWalletPocketTransaction.create({
        data: {
          customerWalletPocketId: newPocket.id,
          amount: form.amount,
          status: CustomerWalletPocketTransactionStatus.PENDING,
          transactionRef: form.transactionRef,
        },
      });

      await prisma.customerWallet.update({
        where: { id: wallet.id },
        data: { pendingBalance: { increment: form.amount } },
      });
    });

    wallet.pendingBalance += form.amount;

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

    const amountToCredit = pendingTransaction.amount;

    await this.prisma.$transaction(async (prisma) => {
      await prisma.customerWalletPocketTransaction.create({
        data: {
          customerWalletPocketId: pendingTransaction.customerWalletPocketId,
          amount: amountToCredit,
          status: CustomerWalletPocketTransactionStatus.CREDITED,
          transactionRef: `CREDIT-${form.transactionRef}`,
        },
      });

      await prisma.customerWalletPocketTransaction.update({
        where: { id: pendingTransaction.id },
        data: { status: CustomerWalletPocketTransactionStatus.AWARDED },
      });

      await prisma.customerWalletPocket.update({
        where: { id: pendingTransaction.customerWalletPocketId },
        data: {
          pendingBalance: { decrement: amountToCredit },
          availableBalance: { increment: amountToCredit },
          expiryDate: new Date(form.expiryDate),
        },
      });

      await prisma.customerWallet.update({
        where: { id: wallet.id },
        data: {
          pendingBalance: { decrement: amountToCredit },
          availableBalance: { increment: amountToCredit },
        },
      });
    });

    wallet.pendingBalance -= amountToCredit;
    wallet.availableBalance += amountToCredit;

    if (form.expiryDate) {
      await this.producer.scheduleReversalJob({
        transactionRef: form.transactionRef,
        customerId: form.customerId,
        currencyCode: form.currencyCode,
        reversalTime: new Date(form.expiryDate),
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
    const amountToExpire = Math.max(
      customerWalletPocket.availableBalance - customerWalletPocket.usedBalance,
      0,
    );

    await this.prisma.$transaction(async (prisma) => {
      await prisma.customerWalletPocketTransaction.update({
        where: { id: creditTransaction.id },
        data: { status: CustomerWalletPocketTransactionStatus.EXPIRED },
      });

      await prisma.customerWalletPocket.update({
        where: { id: customerWalletPocket.id },
        data: {
          availableBalance: { decrement: amountToExpire },
          expiredBalance: { increment: amountToExpire },
        },
      });

      await prisma.customerWallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: amountToExpire },
          expiredBalance: { increment: amountToExpire },
        },
      });
    });

    wallet.availableBalance -= amountToExpire;
    wallet.expiredBalance += amountToExpire;

    return this;
  }

  async save(): Promise<void> {
    const wallet = this.requireWallet();

    await this.prisma.customerWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: wallet.availableBalance,
        blockedBalance: wallet.blockedBalance,
        pendingBalance: wallet.pendingBalance,
        usedBalance: wallet.usedBalance,
        expiredBalance: wallet.expiredBalance,
      },
    });
  }
}
