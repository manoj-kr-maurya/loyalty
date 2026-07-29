import { Injectable, Logger } from '@nestjs/common';
import { EventEngineService, RewardEventName } from '../../core/event-engine/event-engine.service';
import { PromotionRecord } from './promotion-repository.service';
import { ConflictResolution } from './conflict-resolver.service';
import { DiscountResult2 } from './discount-engine.service';
import { CouponBlock } from './coupon-manager.service';
import { ClaimRecord } from './claim-manager.service';

export interface PromoEventPayload {
  eventId: string;
  timestamp: string;
  organizationId: string;
  customerId?: string;
  data: Record<string, any>;
}

/**
 * Promo Event Publisher — emits promo-specific domain events
 * using the core EventEngine.
 *
 * Events:
 * - promo.evaluated — Promotions were evaluated for a transaction.
 * - promo.conflict.resolved — Conflict resolution completed.
 * - promo.discount.computed — Discount was computed.
 * - promo.coupon.allocated — A coupon was allocated.
 * - promo.coupon.blocked — A coupon was blocked (reserved).
 * - promo.coupon.released — A coupon was released.
 * - promo.coupon.claimed — A coupon was claimed.
 * - promo.claim.recorded — A claim was recorded.
 * - promo.claim.revoked — A claim was revoked.
 */
@Injectable()
export class PromoEventPublisherService {
  private readonly logger = new Logger(PromoEventPublisherService.name);

  constructor(private readonly eventEngine: EventEngineService) {}

  // ─── Promotion Evaluation ───────────────────────────────────────

  /** Emit when promotions are evaluated for a transaction. */
  emitPromotionEvaluated(
    organizationId: string,
    customerId: string,
    promotions: PromotionRecord[],
    transactionRef: string,
  ): void {
    this.emit('promo.evaluated', {
      eventId: this.promoId(),
      timestamp: new Date().toISOString(),
      organizationId,
      customerId,
      data: {
        transactionRef,
        promotionCount: promotions.length,
        promotionIds: promotions.map((p) => p.id),
        promotionNames: promotions.map((p) => p.name),
      },
    });
  }

  /** Emit when conflict resolution completes. */
  emitConflictResolved(
    organizationId: string,
    customerId: string,
    resolution: ConflictResolution,
    transactionRef: string,
  ): void {
    this.emit('promo.conflict.resolved', {
      eventId: this.promoId(),
      timestamp: new Date().toISOString(),
      organizationId,
      customerId,
      data: {
        transactionRef,
        winnerCount: resolution.winners.length,
        excludedCount: resolution.excluded.length,
        winnerIds: resolution.winners.map((w) => w.id),
        excludedReasons: resolution.excluded.map((e) => ({
          id: e.promotion.id,
          reason: e.reason,
        })),
      },
    });
  }

  /** Emit when discount is computed. */
  emitDiscountComputed(
    organizationId: string,
    customerId: string,
    discount: DiscountResult2,
    transactionRef: string,
  ): void {
    this.emit('promo.discount.computed', {
      eventId: this.promoId(),
      timestamp: new Date().toISOString(),
      organizationId,
      customerId,
      data: {
        transactionRef,
        totalDiscount: discount.totalDiscount,
        finalAmount: discount.finalAmount,
        wasCapped: discount.wasCapped,
        discountCount: discount.discounts.length,
        discounts: discount.discounts.map((d) => ({
          ruleId: d.ruleId,
          ruleName: d.ruleName,
          amount: d.discountAmount,
          percentage: d.discountPercentage,
        })),
      },
    });
  }

  // ─── Coupon Events ──────────────────────────────────────────────

  /** Emit when a coupon is allocated. */
  emitCouponAllocated(coupon: CouponBlock): void {
    this.emit('promo.coupon.allocated', {
      eventId: this.promoId(),
      timestamp: new Date().toISOString(),
      organizationId: coupon.programId,
      customerId: coupon.customerId,
      data: {
        blockId: coupon.blockId,
        couponCode: coupon.couponCode,
        discountAmount: coupon.discountAmount,
        currency: coupon.currency,
      },
    });
  }

  /** Emit when a coupon is blocked (reserved). */
  emitCouponBlocked(coupon: CouponBlock): void {
    this.emit('promo.coupon.blocked', {
      eventId: this.promoId(),
      timestamp: new Date().toISOString(),
      organizationId: coupon.programId,
      customerId: coupon.customerId,
      data: {
        blockId: coupon.blockId,
        couponCode: coupon.couponCode,
        discountAmount: coupon.discountAmount,
        currency: coupon.currency,
      },
    });
  }

  /** Emit when a coupon is released. */
  emitCouponReleased(coupon: CouponBlock, reason?: string): void {
    this.emit('promo.coupon.released', {
      eventId: this.promoId(),
      timestamp: new Date().toISOString(),
      organizationId: coupon.programId,
      customerId: coupon.customerId,
      data: {
        blockId: coupon.blockId,
        couponCode: coupon.couponCode,
        discountAmount: coupon.discountAmount,
        reason: reason ?? 'released',
      },
    });
  }

  /** Emit when a coupon is claimed. */
  emitCouponClaimed(coupon: CouponBlock, transactionRef: string): void {
    this.emit('promo.coupon.claimed', {
      eventId: this.promoId(),
      timestamp: new Date().toISOString(),
      organizationId: coupon.programId,
      customerId: coupon.customerId,
      data: {
        blockId: coupon.blockId,
        couponCode: coupon.couponCode,
        discountAmount: coupon.discountAmount,
        transactionRef,
      },
    });
  }

  // ─── Claim Events ───────────────────────────────────────────────

  /** Emit when a claim is recorded. */
  emitClaimRecorded(claim: ClaimRecord): void {
    this.emit('promo.claim.recorded', {
      eventId: this.promoId(),
      timestamp: new Date().toISOString(),
      organizationId: claim.programId,
      customerId: claim.customerId,
      data: {
        claimId: claim.id,
        rewardType: claim.rewardType,
        amount: claim.amount,
        currency: claim.currency,
        transactionRef: claim.transactionRef,
      },
    });
  }

  /** Emit when a claim is revoked. */
  emitClaimRevoked(claim: ClaimRecord, reason: string): void {
    this.emit('promo.claim.revoked', {
      eventId: this.promoId(),
      timestamp: new Date().toISOString(),
      organizationId: claim.programId,
      customerId: claim.customerId,
      data: {
        claimId: claim.id,
        rewardType: claim.rewardType,
        amount: claim.amount,
        reason,
      },
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private emit(eventName: RewardEventName, payload: PromoEventPayload): void {
    this.eventEngine.publish(eventName, payload);
    this.logger.debug(`Event emitted: ${eventName} | id=${payload.eventId}`);
  }

  private promoId(): string {
    return `promo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}