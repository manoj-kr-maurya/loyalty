import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prismaService';
import { RewardType } from '@prisma/client';

export interface ClaimRecord {
  id: string;
  customerId: string;
  programId: string;
  rewardType: string;
  amount: number;
  currency: string;
  transactionRef: string;
  status: 'PENDING' | 'CONFIRMED' | 'REVOKED';
  details: Record<string, any>;
  claimedAt: Date;
}

export interface ClaimInput {
  customerId: string;
  programId: string;
  rewardType: string;
  amount: number;
  currency: string;
  transactionRef: string;
  details?: Record<string, any>;
}

export interface ClaimQuery {
  customerId?: string;
  programId?: string;
  transactionRef?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Claim Manager — records successful claims and usage.
 *
 * Uses the existing RewardLedger model to persist claim records.
 * Every claim is an immutable ledger entry for auditability.
 *
 * Operations:
 * - recordClaim: Create a new claim in the ledger.
 * - confirmClaim: Mark a pending claim as confirmed.
 * - revokeClaim: Revoke a claim (e.g., refund).
 * - getClaims: Query claims with filters.
 * - getClaimById: Get a single claim by ID.
 */
@Injectable()
export class ClaimManagerService {
  private readonly logger = new Logger(ClaimManagerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a new claim in the ledger.
   */
  async recordClaim(input: ClaimInput): Promise<ClaimRecord> {
    const ledger = await this.prisma.rewardLedger.create({
      data: {
        customerId: input.customerId,
        programId: input.programId,
        rewardType: input.rewardType as RewardType,
        amount: input.amount,
        details: {
          currency: input.currency,
          ...input.details,
        },
        transactionRef: input.transactionRef,
        status: 'CREDITED',
      },
    });

    this.logger.log(
      `Claim recorded: ${ledger.id} | customer=${input.customerId} | amount=${input.amount} | txn=${input.transactionRef}`,
    );

    return this.toClaimRecord(ledger);
  }

  /**
   * Record a batch of claims atomically.
   */
  async recordClaims(inputs: ClaimInput[]): Promise<ClaimRecord[]> {
    const records: ClaimRecord[] = [];

    for (const input of inputs) {
      const record = await this.recordClaim(input);
      records.push(record);
    }

    this.logger.log(`Batch claims recorded: ${records.length} claims`);
    return records;
  }

  /**
   * Revoke a claim (e.g., for refunds or disputes).
   * Creates a reversing entry in the ledger.
   */
  async revokeClaim(
    claimId: string,
    reason: string,
    actor?: string,
  ): Promise<ClaimRecord | null> {
    const existing = await this.prisma.rewardLedger.findUnique({
      where: { id: claimId },
    });

    if (!existing) {
      this.logger.warn(`Claim not found for revocation: ${claimId}`);
      return null;
    }

    if (existing.status === 'REVERSED') {
      this.logger.warn(`Claim ${claimId} already reversed`);
      return null;
    }

    // Create a reversal entry
    const reversal = await this.prisma.rewardLedger.create({
      data: {
        customerId: existing.customerId,
        programId: existing.programId,
        rewardType: existing.rewardType,
        amount: -existing.amount, // Negative amount for reversal
        details: {
          originalClaimId: claimId,
          reason,
          actor: actor ?? 'system',
          reversedAt: new Date().toISOString(),
          originalDetails: existing.details,
        },
        transactionRef: `REV-${existing.transactionRef}`,
        status: 'REVERSED',
      },
    });

    // Mark original as reversed
    await this.prisma.rewardLedger.update({
      where: { id: claimId },
      data: { status: 'REVERSED' },
    });

    this.logger.log(
      `Claim revoked: ${claimId} | reason=${reason} | reversal=${reversal.id}`,
    );

    return this.toClaimRecord(reversal);
  }

  /**
   * Get claims with optional filters.
   */
  async getClaims(query: ClaimQuery = {}): Promise<ClaimRecord[]> {
    const where: any = {};

    if (query.customerId) where.customerId = query.customerId;
    if (query.programId) where.programId = query.programId;
    if (query.transactionRef) where.transactionRef = query.transactionRef;
    if (query.status) where.status = query.status;

    const ledgers = await this.prisma.rewardLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
      skip: query.offset ?? 0,
    });

    return ledgers.map((l) => this.toClaimRecord(l));
  }

  /**
   * Get a single claim by ID.
   */
  async getClaimById(id: string): Promise<ClaimRecord | null> {
    const ledger = await this.prisma.rewardLedger.findUnique({
      where: { id },
    });

    if (!ledger) return null;
    return this.toClaimRecord(ledger);
  }

  /**
   * Get total claimed amount for a customer within a program.
   */
  async getTotalClaimed(customerId: string, programId: string): Promise<number> {
    const result = await this.prisma.rewardLedger.aggregate({
      where: {
        customerId,
        programId,
        status: 'CREDITED',
      },
      _sum: { amount: true },
    });

    return Number(result._sum.amount) || 0;
  }

  /**
   * Get claim summary for a customer across all programs.
   */
  async getCustomerClaimSummary(customerId: string): Promise<{
    totalClaimed: number;
    totalReversed: number;
    claimCount: number;
  }> {
    const [credited, reversed, count] = await Promise.all([
      this.prisma.rewardLedger.aggregate({
        where: { customerId, status: 'CREDITED' },
        _sum: { amount: true },
      }),
      this.prisma.rewardLedger.aggregate({
        where: { customerId, status: 'REVERSED' },
        _sum: { amount: true },
      }),
      this.prisma.rewardLedger.count({
        where: { customerId, status: 'CREDITED' },
      }),
    ]);

    return {
      totalClaimed: Number(credited._sum.amount) || 0,
      totalReversed: Math.abs(Number(reversed._sum.amount) || 0),
      claimCount: count,
    };
  }

  /**
   * Map a Prisma RewardLedger to a ClaimRecord.
   */
  private toClaimRecord(ledger: any): ClaimRecord {
    const details = (ledger.details as Record<string, any>) ?? {};

    return {
      id: ledger.id,
      customerId: ledger.customerId,
      programId: ledger.programId,
      rewardType: ledger.rewardType,
      amount: Number(ledger.amount),
      currency: details?.currency ?? 'INR',
      transactionRef: ledger.transactionRef,
      status: this.mapLedgerStatus(ledger.status),
      details,
      claimedAt: ledger.createdAt,
    };
  }

  private mapLedgerStatus(dbStatus: string): 'PENDING' | 'CONFIRMED' | 'REVOKED' {
    switch (dbStatus) {
      case 'PENDING':
        return 'PENDING';
      case 'CREDITED':
      case 'DEBITED':
        return 'CONFIRMED';
      case 'REVERSED':
      case 'EXPIRED':
        return 'REVOKED';
      default:
        return 'CONFIRMED';
    }
  }
}