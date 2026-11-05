import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prismaService';

export interface CouponAllocation {
  programId: string;
  customerId: string;
  couponCode: string;
  discountAmount: number;
  currency: string;
  expiresAt?: Date;
  meta?: Record<string, any>;
}

export interface CouponBlock {
  blockId: string;
  programId: string;
  customerId: string;
  couponCode: string;
  discountAmount: number;
  currency: string;
  status: 'BLOCKED' | 'CLAIMED' | 'RELEASED' | 'EXPIRED';
  expiresAt?: Date;
  meta?: Record<string, any>;
}

export interface CouponClaim {
  blockId: string;
  customerId: string;
  couponCode: string;
  transactionRef: string;
  claimedAmount: number;
  meta?: Record<string, any>;
}

/**
 * Coupon Manager — allocates, blocks, releases, and claims coupons.
 *
 * Uses the existing RewardBlock model in Prisma to persist coupon state.
 * Coupons are a specific rewardType (COUPON) within the RewardProgram system.
 *
 * Lifecycle:
 *   ALLOCATED → BLOCKED → CLAIMED
 *                    ↘ RELEASED (back to available)
 */
@Injectable()
export class CouponManagerService {
  private readonly logger = new Logger(CouponManagerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Allocate a coupon to a customer. Creates a RewardBlock in PENDING state.
   */
  async allocate(allocation: CouponAllocation): Promise<CouponBlock> {
    const blockId = `CPN-${allocation.programId}-${
      allocation.customerId
    }-${Date.now()}`;

    const block = await this.prisma.rewardBlock.create({
      data: {
        blockId,
        programId: allocation.programId,
        customerId: allocation.customerId,
        awardDetails: {
          couponCode: allocation.couponCode,
          discountAmount: allocation.discountAmount,
          currency: allocation.currency,
          ...allocation.meta,
        },
        status: 'PENDING',
        expiresAt: allocation.expiresAt ?? null,
      },
    });

    this.logger.log(`Coupon allocated: ${blockId} → ${allocation.customerId}`);

    return {
      blockId: block.blockId,
      programId: block.programId,
      customerId: block.customerId,
      couponCode: allocation.couponCode,
      discountAmount: allocation.discountAmount,
      currency: allocation.currency,
      status: 'BLOCKED',
      expiresAt: block.expiresAt ?? undefined,
      meta: allocation.meta,
    };
  }

  /**
   * Block (reserve) a coupon for a customer. Moves PENDING → CONFIRMED.
   * This prevents the coupon from being used by another transaction.
   */
  async block(blockId: string): Promise<CouponBlock | null> {
    const existing = await this.prisma.rewardBlock.findUnique({
      where: { blockId },
    });

    if (!existing) {
      this.logger.warn(`Coupon block not found: ${blockId}`);
      return null;
    }

    if (existing.status !== 'PENDING') {
      this.logger.warn(
        `Coupon ${blockId} is not in PENDING state: ${existing.status}`,
      );
      return null;
    }

    const updated = await this.prisma.rewardBlock.update({
      where: { blockId },
      data: { status: 'CONFIRMED' },
    });

    const details = updated.awardDetails as Record<string, any>;

    this.logger.log(`Coupon blocked: ${blockId}`);

    return {
      blockId: updated.blockId,
      programId: updated.programId,
      customerId: updated.customerId,
      couponCode: details?.couponCode ?? '',
      discountAmount: details?.discountAmount ?? 0,
      currency: details?.currency ?? 'INR',
      status: 'BLOCKED',
      expiresAt: updated.expiresAt ?? undefined,
      meta: details,
    };
  }

  /**
   * Release a blocked coupon back to the pool. Moves CONFIRMED → CANCELLED.
   */
  async release(blockId: string, reason?: string): Promise<CouponBlock | null> {
    const existing = await this.prisma.rewardBlock.findUnique({
      where: { blockId },
    });

    if (!existing) {
      this.logger.warn(`Coupon block not found for release: ${blockId}`);
      return null;
    }

    if (existing.status === 'CANCELLED' || existing.status === 'EXPIRED') {
      this.logger.warn(
        `Coupon ${blockId} already in terminal state: ${existing.status}`,
      );
      return null;
    }

    const updated = await this.prisma.rewardBlock.update({
      where: { blockId },
      data: {
        status: 'CANCELLED',
        awardDetails: {
          ...((existing.awardDetails as Record<string, any>) ?? {}),
          releaseReason: reason ?? 'released',
          releasedAt: new Date().toISOString(),
        },
      },
    });

    const details = updated.awardDetails as Record<string, any>;

    this.logger.log(`Coupon released: ${blockId} (reason: ${reason ?? 'N/A'})`);

    return {
      blockId: updated.blockId,
      programId: updated.programId,
      customerId: updated.customerId,
      couponCode: details?.couponCode ?? '',
      discountAmount: details?.discountAmount ?? 0,
      currency: details?.currency ?? 'INR',
      status: 'RELEASED',
      expiresAt: updated.expiresAt ?? undefined,
      meta: details,
    };
  }

  /**
   * Claim a coupon — finalize the usage. Moves CONFIRMED → keeps CONFIRMED
   * but records the claim in the ledger.
   */
  async claim(claim: CouponClaim): Promise<CouponBlock | null> {
    const existing = await this.prisma.rewardBlock.findUnique({
      where: { blockId: claim.blockId },
    });

    if (!existing) {
      this.logger.warn(`Coupon block not found for claim: ${claim.blockId}`);
      return null;
    }

    if (existing.status !== 'CONFIRMED') {
      this.logger.warn(
        `Coupon ${claim.blockId} must be CONFIRMED to claim, current: ${existing.status}`,
      );
      return null;
    }

    // Create a ledger entry for the claim
    await this.prisma.rewardLedger.create({
      data: {
        customerId: claim.customerId,
        programId: existing.programId,
        rewardType: 'COUPON',
        amount: claim.claimedAmount,
        details: {
          couponCode: claim.couponCode,
          blockId: claim.blockId,
          transactionRef: claim.transactionRef,
          ...claim.meta,
        },
        transactionRef: claim.transactionRef,
        status: 'CREDITED',
      },
    });

    const details = existing.awardDetails as Record<string, any>;

    this.logger.log(
      `Coupon claimed: ${claim.blockId} | txn=${claim.transactionRef} | amount=${claim.claimedAmount}`,
    );

    return {
      blockId: existing.blockId,
      programId: existing.programId,
      customerId: existing.customerId,
      couponCode: claim.couponCode,
      discountAmount: claim.claimedAmount,
      currency: details?.currency ?? 'INR',
      status: 'CLAIMED',
      expiresAt: existing.expiresAt ?? undefined,
      meta: { ...details, transactionRef: claim.transactionRef },
    };
  }

  /**
   * Get all coupons for a customer.
   */
  async getCustomerCoupons(
    customerId: string,
    organizationId?: string,
  ): Promise<CouponBlock[]> {
    const blocks = await this.prisma.rewardBlock.findMany({
      where: {
        customerId,
        ...(organizationId ? { program: { organizationId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((b) => {
      const details = (b.awardDetails as Record<string, any>) ?? {};
      return {
        blockId: b.blockId,
        programId: b.programId,
        customerId: b.customerId,
        couponCode: details?.couponCode ?? '',
        discountAmount: details?.discountAmount ?? 0,
        currency: details?.currency ?? 'INR',
        status: this.mapStatus(b.status),
        expiresAt: b.expiresAt ?? undefined,
        meta: details,
      };
    });
  }

  /**
   * Get a specific coupon by its block ID.
   */
  async getCoupon(
    blockId: string,
    organizationId?: string,
  ): Promise<CouponBlock | null> {
    const block = await this.prisma.rewardBlock.findFirst({
      where: {
        blockId,
        ...(organizationId ? { program: { organizationId } } : {}),
      },
    });

    if (!block) return null;

    const details = (block.awardDetails as Record<string, any>) ?? {};
    return {
      blockId: block.blockId,
      programId: block.programId,
      customerId: block.customerId,
      couponCode: details?.couponCode ?? '',
      discountAmount: details?.discountAmount ?? 0,
      currency: details?.currency ?? 'INR',
      status: this.mapStatus(block.status),
      expiresAt: block.expiresAt ?? undefined,
      meta: details,
    };
  }

  private mapStatus(dbStatus: string): 'BLOCKED' | 'CLAIMED' | 'RELEASED' {
    switch (dbStatus) {
      case 'PENDING':
      case 'CONFIRMED':
        return 'BLOCKED';
      case 'CANCELLED':
        return 'RELEASED';
      case 'EXPIRED':
        return 'RELEASED';
      default:
        return 'BLOCKED';
    }
  }
}
