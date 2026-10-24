import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CustomerWalletPocketTransactionStatus,
  LoyaltyLedgerType,
  Prisma,
} from '@prisma/client';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

export interface WalletLedgerMutationResult {
  ledgerEntryId: string;
  walletBalance: number;
}

export interface CreditWalletParams {
  customerId: string;
  organizationId: string;
  currencyCode: string;
  points: number;
  type: LoyaltyLedgerType;
  expiryDate?: Date | null;
  referenceType?: string;
  referenceId?: string;
  transactionRef?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface DebitWalletParams {
  customerId: string;
  organizationId: string;
  currencyCode: string;
  points: number;
  type: LoyaltyLedgerType;
  referenceType?: string;
  referenceId?: string;
  transactionRef?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class WalletLedgerService {
  private readonly logger = new Logger(WalletLedgerService.name);

  // Credit is the only path that creates new pockets. A pocket carries its own
  // expiry date so the expiry job can operate without guessing.
  async credit(
    tx: Prisma.TransactionClient,
    params: CreditWalletParams,
  ): Promise<WalletLedgerMutationResult> {
    const points = this.normalizePoints(params.points);
    await this.assertCurrencyOwnership(
      tx,
      params.organizationId,
      params.currencyCode,
    );
    await this.reserveBucketFunds(tx, params.organizationId, params.currencyCode, points);

    const wallet = await tx.customerWallet.upsert({
      where: {
        customer_id_currency_code: {
          customerId: params.customerId,
          currencyCode: params.currencyCode,
        },
      },
      update: { availableBalance: { increment: points } },
      create: {
        customerId: params.customerId,
        currencyCode: params.currencyCode,
        availableBalance: points,
      },
    });

    const transactionRef = this.resolveTransactionRef(params);

    const pocket = await tx.customerWalletPocket.create({
      data: {
        customerWalletId: wallet.id,
        availableBalance: points,
        expiryDate: params.expiryDate ?? null,
      },
    });

    await tx.customerWalletPocketTransaction.create({
      data: {
        customerWalletPocketId: pocket.id,
        amount: points,
        status: CustomerWalletPocketTransactionStatus.CREDITED,
        transactionRef,
      },
    });

    return this.appendLedger(tx, {
      customerId: params.customerId,
      organizationId: params.organizationId,
      currencyCode: params.currencyCode,
      type: params.type,
      points,
      balanceAfter: wallet.availableBalance,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    });
  }

  // Debit consumes pockets FIFO: nearest expiry first, then oldest pockets.
  async debitFifo(
    tx: Prisma.TransactionClient,
    params: DebitWalletParams,
  ): Promise<WalletLedgerMutationResult> {
    const points = this.normalizePoints(params.points);
    await this.assertCurrencyOwnership(
      tx,
      params.organizationId,
      params.currencyCode,
    );

    const wallet = await tx.customerWallet.findUnique({
      where: {
        customer_id_currency_code: {
          customerId: params.customerId,
          currencyCode: params.currencyCode,
        },
      },
    });

    if (!wallet) {
      throw new CommonException(
        `Wallet not found for customer ${params.customerId} and currency ${params.currencyCode}`,
        StatusCodes.NOT_FOUND,
      );
    }

    if (wallet.availableBalance < points) {
      throw new CommonException(
        `Insufficient balance. Available: ${wallet.availableBalance}, Requested: ${points}`,
        StatusCodes.BAD_REQUEST,
      );
    }

    const transactionRef = this.resolveTransactionRef(params);
    const pockets = await tx.customerWalletPocket.findMany({
      where: {
        customerWalletId: wallet.id,
        availableBalance: { gt: 0 },
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });

    let remaining = points;
    for (const pocket of pockets) {
      if (remaining <= 0) break;

      const amountToDebit = Math.min(remaining, pocket.availableBalance);
      if (amountToDebit <= 0) continue;

      const updated = await tx.customerWalletPocket.updateMany({
        where: {
          id: pocket.id,
          availableBalance: { gte: amountToDebit },
        },
        data: { availableBalance: { decrement: amountToDebit } },
      });

      if (updated.count === 0) {
        throw new CommonException(
          'Wallet was modified concurrently. Please retry.',
          StatusCodes.CONFLICT,
        );
      }

      await tx.customerWalletPocketTransaction.create({
        data: {
          customerWalletPocketId: pocket.id,
          amount: amountToDebit,
          status: CustomerWalletPocketTransactionStatus.DEBITED,
          transactionRef,
        },
      });

      remaining -= amountToDebit;
    }

    if (remaining > 0) {
      throw new CommonException(
        'Insufficient pocket balance to complete the debit',
        StatusCodes.BAD_REQUEST,
      );
    }

    const updatedWallet = await tx.customerWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: { decrement: points },
        usedBalance: { increment: points },
      },
    });

    return this.appendLedger(tx, {
      customerId: params.customerId,
      organizationId: params.organizationId,
      currencyCode: params.currencyCode,
      type: params.type,
      points: -points,
      balanceAfter: updatedWallet.availableBalance,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    });
  }

  /**
   * Moves points from the organization's available bucket into the
   * distributed bucket. Without this every earn was backed by thin air.
   */
  private async reserveBucketFunds(
    tx: Prisma.TransactionClient,
    organizationId: string,
    currencyCode: string,
    points: number,
  ): Promise<void> {
    const bucket = await tx.currencyBucket.findUnique({
      where: {
        organization_id_currency_code: { organizationId, code: currencyCode },
      },
      select: { id: true, availableAmount: true },
    });

    if (!bucket) {
      throw new CommonException(
        `Currency bucket not found for ${currencyCode}`,
        StatusCodes.NOT_FOUND,
      );
    }

    if (bucket.availableAmount < points) {
      throw new CommonException(
        `Organization does not have enough ${currencyCode} to distribute`,
        StatusCodes.CONFLICT,
      );
    }

    await tx.currencyBucket.update({
      where: { id: bucket.id },
      data: {
        availableAmount: { decrement: points },
        distributedAmount: { increment: points },
      },
    });

    await tx.currencyBucketTransaction.create({
      data: {
        currencyBucketId: bucket.id,
        amount: points,
        status: CustomerWalletPocketTransactionStatus.AWARDED,
        transactionRef: randomUUID(),
      },
    });
  }

  /**
   * Expires only pockets whose own expiry date is on or before `asOf`.
   * The wallet aggregate, pocket rows, transaction trail, and ledger entry
   * are updated in one transaction.
   */
  async expirePockets(
    tx: Prisma.TransactionClient,
    params: {
      customerId: string;
      organizationId: string;
      currencyCode: string;
      asOf: Date;
    },
  ): Promise<{ expiredPoints: number }> {
    const wallet = await tx.customerWallet.findUnique({
      where: {
        customer_id_currency_code: {
          customerId: params.customerId,
          currencyCode: params.currencyCode,
        },
      },
    });

    if (!wallet) return { expiredPoints: 0 };

    const pockets = await tx.customerWalletPocket.findMany({
      where: {
        customerWalletId: wallet.id,
        availableBalance: { gt: 0 },
        expiryDate: { not: null, lte: params.asOf },
      },
    });

    let totalExpired = 0;

    for (const pocket of pockets) {
      const amount = pocket.availableBalance;
      if (amount <= 0) continue;

      const updated = await tx.customerWalletPocket.updateMany({
        where: { id: pocket.id, availableBalance: amount },
        data: { availableBalance: 0 },
      });

      if (updated.count === 0) {
        throw new CommonException(
          'Wallet was modified concurrently. Please retry.',
          StatusCodes.CONFLICT,
        );
      }

      await tx.customerWalletPocketTransaction.create({
        data: {
          customerWalletPocketId: pocket.id,
          amount,
          status: CustomerWalletPocketTransactionStatus.EXPIRED,
          transactionRef: randomUUID(),
        },
      });

      totalExpired += amount;
    }

    if (totalExpired === 0) return { expiredPoints: 0 };

    const updatedWallet = await tx.customerWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: { decrement: totalExpired },
        expiredBalance: { increment: totalExpired },
      },
    });

    await this.appendLedger(tx, {
      customerId: params.customerId,
      organizationId: params.organizationId,
      currencyCode: params.currencyCode,
      type: LoyaltyLedgerType.EXPIRE,
      points: -totalExpired,
      balanceAfter: updatedWallet.availableBalance,
      referenceType: 'EXPIRY',
      referenceId: params.asOf.toISOString(),
    });

    return { expiredPoints: totalExpired };
  }

  private async assertCurrencyOwnership(
    tx: Prisma.TransactionClient,
    organizationId: string,
    currencyCode: string,
  ): Promise<void> {
    const currency = await tx.currency.findUnique({
      where: { code: currencyCode },
      select: { organizationId: true },
    });

    if (!currency) {
      throw new CommonException(
        `Currency ${currencyCode} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    if (currency.organizationId !== organizationId) {
      throw new CommonException(
        `Currency ${currencyCode} does not belong to organization ${organizationId}`,
        StatusCodes.BAD_REQUEST,
      );
    }
  }

  private async appendLedger(
    tx: Prisma.TransactionClient,
    params: {
      customerId: string;
      organizationId: string;
      currencyCode: string;
      type: LoyaltyLedgerType;
      points: number;
      balanceAfter: number;
      referenceType?: string;
      referenceId?: string;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<WalletLedgerMutationResult> {
    const ledger = await tx.loyaltyLedgerEntry.create({
      data: {
        customerId: params.customerId,
        organizationId: params.organizationId,
        currencyCode: params.currencyCode,
        type: params.type,
        points: params.points,
        balanceAfter: params.balanceAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        idempotencyKey: params.idempotencyKey,
        ...(params.metadata !== undefined && {
          metadata: params.metadata as Prisma.InputJsonValue,
        }),
      },
    });

    this.logger.log(
      `Ledger ${params.type}: customer=${params.customerId} org=${params.organizationId} points=${params.points} balanceAfter=${params.balanceAfter}`,
    );

    return {
      ledgerEntryId: ledger.id,
      walletBalance: params.balanceAfter,
    };
  }

  private normalizePoints(points: number): number {
    const normalized = Math.trunc(points);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      throw new CommonException(
        'Points must be a positive integer',
        StatusCodes.BAD_REQUEST,
      );
    }
    return normalized;
  }

  private resolveTransactionRef(params: {
    transactionRef?: string;
    referenceId?: string;
    idempotencyKey?: string;
  }): string {
    return (
      params.transactionRef ??
      params.referenceId ??
      params.idempotencyKey ??
      randomUUID()
    );
  }
}
