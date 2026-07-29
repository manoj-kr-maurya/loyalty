import { Injectable, Logger } from '@nestjs/common';
import { RuleEngineService } from 'src/modules/core/rule-engine/rule-engine.service';
import { EligibilityEngineService } from 'src/modules/core/eligibility-engine/eligibility-engine.service';
import { BudgetEngineService } from 'src/modules/core/budget-engine/budget-engine.service';
import { EventEngineService } from 'src/modules/core/event-engine/event-engine.service';
import { AuditEngineService } from 'src/modules/core/audit-engine/audit-engine.service';
import { FilterContext, RuleDefinition } from 'src/modules/core/rule-engine/rule-engine.types';
import { EligibilityCriteria } from 'src/modules/core/eligibility-engine/eligibility-engine.service';
import { BudgetReservation } from 'src/modules/core/budget-engine/budget-engine.service';
import { AuditEntry } from 'src/modules/core/audit-engine/audit-engine.service';
import { RewardEventPayload } from 'src/modules/core/event-engine/event-engine.service';

import { PromotionRepositoryService, PromotionQuery, PromotionRecord } from './promotion-repository.service';
import { ConflictResolverService, ConflictResolution, ConflictStrategy } from './conflict-resolver.service';
import { DiscountEngineService, DiscountResult2 } from './discount-engine.service';
import { CouponManagerService, CouponAllocation, CouponBlock, CouponClaim } from './coupon-manager.service';
import { ClaimManagerService, ClaimInput, ClaimRecord, ClaimQuery } from './claim-manager.service';
import { PromoEventPublisherService } from './promo-event-publisher.service';

export interface EvaluatePromotionsInput {
  organizationId: string;
  customerId: string;
  transactionAmount: number;
  currency: string;
  transactionRef: string;
  context?: Record<string, any>;
  conflictStrategy?: ConflictStrategy;
  maxStackable?: number;
  maxDiscountAmount?: number;
  maxDiscountPercentage?: number;
}

export interface EvaluatePromotionsOutput {
  success: boolean;
  transactionRef: string;
  eligiblePromotions: number;
  conflictResolution: ConflictResolution;
  discount: DiscountResult2;
  budgetReservations: any[];
}

@Injectable()
export class PromoService {
  private readonly logger = new Logger(PromoService.name);

  constructor(
    private readonly ruleEngine: RuleEngineService,
    private readonly eligibilityEngine: EligibilityEngineService,
    private readonly budgetEngine: BudgetEngineService,
    private readonly eventEngine: EventEngineService,
    private readonly auditEngine: AuditEngineService,
    private readonly promotionRepo: PromotionRepositoryService,
    private readonly conflictResolver: ConflictResolverService,
    private readonly discountEngine: DiscountEngineService,
    private readonly couponManager: CouponManagerService,
    private readonly claimManager: ClaimManagerService,
    private readonly promoEvents: PromoEventPublisherService,
  ) {}

  // ─── Promotion CRUD ────────────────────────────────────────────

  async createPromotion(
    form: any,
    context: FilterContext,
    criteria: EligibilityCriteria,
    rules: RuleDefinition[],
    budgetReservation: BudgetReservation,
  ) {
    const eligibility = this.eligibilityEngine.evaluateEligibility(criteria, context);
    const ruleResult = this.ruleEngine.evaluateRules(rules, context);
    const budgetResult = await this.budgetEngine.reserveBudget(budgetReservation);

    const auditEntry: AuditEntry = {
      entityType: 'Promotion',
      action: 'createPromotion',
      details: { form, ruleResult, budgetResult },
    };
    this.auditEngine.log(auditEntry);

    const eventPayload: RewardEventPayload = {
      programId: budgetReservation.programId,
      customerId: context.customerId ?? 'unknown',
      rewardType: 'promo',
      amount: ruleResult.totalAward,
      transactionRef: budgetReservation.reference,
      meta: { form, ruleResult, eligibility },
      timestamp: new Date().toISOString(),
    };
    this.eventEngine.publish('reward.calculated', eventPayload);

    return {
      success: true,
      promotion: form,
      awards: ruleResult.awards,
      eligibility,
      budget: budgetResult,
    };
  }

  // ─── Promotion Evaluation (Full Pipeline) ──────────────────────

  /**
   * Full promotion evaluation pipeline:
   * 1. Load active promotions from repository
   * 2. Filter by eligibility
   * 3. Evaluate rules for each eligible promotion
   * 4. Resolve conflicts
   * 5. Compute discounts
   * 6. Reserve budget
   * 7. Emit events & audit
   */
  async evaluatePromotions(input: EvaluatePromotionsInput): Promise<EvaluatePromotionsOutput> {
    const {
      organizationId,
      customerId,
      transactionAmount,
      currency,
      transactionRef,
      context = {},
      conflictStrategy = 'PRIORITY',
      maxStackable = 3,
      maxDiscountAmount,
      maxDiscountPercentage,
    } = input;

    // 1. Load active promotions
    const activePromotions = await this.promotionRepo.findActive({
      organizationId,
      programType: 'PROMO',
    });

    this.promoEvents.emitPromotionEvaluated(
      organizationId,
      customerId,
      activePromotions,
      transactionRef,
    );

    if (activePromotions.length === 0) {
      return {
        success: true,
        transactionRef,
        eligiblePromotions: 0,
        conflictResolution: { winners: [], excluded: [], resolvedAwards: [] },
        discount: {
          discounts: [],
          totalDiscount: 0,
          finalAmount: transactionAmount,
          wasCapped: false,
        },
        budgetReservations: [],
      };
    }

    // 2. Build filter context
    const filterContext: FilterContext = {
      customerId,
      organizationId,
      transactionAmount,
      currency,
      ...context,
    };

    // 3. Evaluate each promotion: eligibility + rules
    const evaluated = [];
    for (const promo of activePromotions) {
      // Eligibility check
      const eligibilityCriteria: EligibilityCriteria = {
        startDate: promo.startDate,
        endDate: promo.endDate,
        timezone: promo.timezone,
        blackoutDates: promo.blackoutDates ?? undefined,
        workingDays: promo.workingDays ?? undefined,
        dailyTimeSlots: promo.dailyTimeSlots ?? undefined,
      };

      const eligibility = this.eligibilityEngine.evaluateEligibility(
        eligibilityCriteria,
        filterContext,
      );

      if (!eligibility.eligible) {
        this.logger.debug(
          `Promotion ${promo.name} not eligible: ${eligibility.reasons.join(', ')}`,
        );
        continue;
      }

      // Rule evaluation
      const ruleResult = this.ruleEngine.evaluateRules(
        promo.rules,
        filterContext,
        transactionAmount,
      );

      if (ruleResult.rulesMatched.length > 0) {
        evaluated.push({ promotion: promo, result: ruleResult });
      }
    }

    // 4. Resolve conflicts
    const resolved = this.conflictResolver.resolve(evaluated, {
      defaultStrategy: conflictStrategy,
      maxStackable,
    });

    this.promoEvents.emitConflictResolved(
      organizationId,
      customerId,
      resolved,
      transactionRef,
    );

    // 5. Compute discounts
    const discount = this.discountEngine.compute(
      transactionAmount,
      currency,
      resolved.resolvedAwards,
      maxDiscountAmount !== undefined || maxDiscountPercentage !== undefined
        ? { amount: maxDiscountAmount ?? 0, percentage: maxDiscountPercentage ?? 0 }
        : undefined,
    );

    this.promoEvents.emitDiscountComputed(
      organizationId,
      customerId,
      discount,
      transactionRef,
    );

    // 6. Reserve budget for each winning promotion
    const budgetReservations = [];
    for (const winner of resolved.winners) {
      if (winner.budgetEnabled) {
        const budgetResult = await this.budgetEngine.reserveBudget({
          programId: winner.id,
          amount: discount.totalDiscount,
          reference: transactionRef,
          currency,
        });
        budgetReservations.push(budgetResult);
      }
    }

    // 7. Audit log
    const auditEntry: AuditEntry = {
      action: 'evaluatePromotions',
      entityType: 'Promotion',
      details: {
        transactionRef,
        organizationId,
        customerId,
        transactionAmount,
        eligibleCount: evaluated.length,
        winnerCount: resolved.winners.length,
        totalDiscount: discount.totalDiscount,
        finalAmount: discount.finalAmount,
      },
    };
    this.auditEngine.log(auditEntry);

    return {
      success: true,
      transactionRef,
      eligiblePromotions: evaluated.length,
      conflictResolution: resolved,
      discount,
      budgetReservations,
    };
  }

  // ─── Coupon Operations ─────────────────────────────────────────

  /** Allocate a new coupon to a customer. */
  async allocateCoupon(allocation: CouponAllocation): Promise<CouponBlock> {
    const coupon = await this.couponManager.allocate(allocation);
    this.promoEvents.emitCouponAllocated(coupon);

    this.auditEngine.log({
      action: 'allocateCoupon',
      entityType: 'Coupon',
      details: { allocation, blockId: coupon.blockId },
    });

    return coupon;
  }

  /** Block (reserve) a coupon for a transaction. */
  async blockCoupon(blockId: string): Promise<CouponBlock | null> {
    const coupon = await this.couponManager.block(blockId);
    if (coupon) {
      this.promoEvents.emitCouponBlocked(coupon);
    }
    return coupon;
  }

  /** Release a blocked coupon back to the pool. */
  async releaseCoupon(blockId: string, reason?: string): Promise<CouponBlock | null> {
    const coupon = await this.couponManager.release(blockId, reason);
    if (coupon) {
      this.promoEvents.emitCouponReleased(coupon, reason);
    }
    return coupon;
  }

  /** Claim a coupon — finalize usage. */
  async claimCoupon(claim: CouponClaim): Promise<CouponBlock | null> {
    const coupon = await this.couponManager.claim(claim);
    if (coupon) {
      this.promoEvents.emitCouponClaimed(coupon, claim.transactionRef);

      this.auditEngine.log({
        action: 'claimCoupon',
        entityType: 'Coupon',
        details: { claim, blockId: coupon.blockId },
      });
    }
    return coupon;
  }

  /** Get all coupons for a customer. */
  async getCustomerCoupons(customerId: string): Promise<CouponBlock[]> {
    return this.couponManager.getCustomerCoupons(customerId);
  }

  /** Get a specific coupon by block ID. */
  async getCoupon(blockId: string): Promise<CouponBlock | null> {
    return this.couponManager.getCoupon(blockId);
  }

  // ─── Claim Operations ──────────────────────────────────────────

  /** Record a new claim. */
  async recordClaim(input: ClaimInput): Promise<ClaimRecord> {
    const claim = await this.claimManager.recordClaim(input);
    this.promoEvents.emitClaimRecorded(claim);

    this.auditEngine.log({
      action: 'recordClaim',
      entityType: 'Claim',
      details: { input, claimId: claim.id },
    });

    return claim;
  }

  /** Revoke a claim (e.g., for refunds). */
  async revokeClaim(claimId: string, reason: string, actor?: string): Promise<ClaimRecord | null> {
    const claim = await this.claimManager.revokeClaim(claimId, reason, actor);
    if (claim) {
      this.promoEvents.emitClaimRevoked(claim, reason);
    }
    return claim;
  }

  /** Get claims with filters. */
  async getClaims(query: ClaimQuery): Promise<ClaimRecord[]> {
    return this.claimManager.getClaims(query);
  }

  /** Get a single claim by ID. */
  async getClaimById(id: string): Promise<ClaimRecord | null> {
    return this.claimManager.getClaimById(id);
  }

  /** Get claim summary for a customer. */
  async getCustomerClaimSummary(customerId: string) {
    return this.claimManager.getCustomerClaimSummary(customerId);
  }

  // ─── Promotion Queries ─────────────────────────────────────────

  /** Get active promotions for an organization. */
  async getActivePromotions(organizationId: string): Promise<PromotionRecord[]> {
    return this.promotionRepo.findActive({ organizationId, programType: 'PROMO' });
  }

  /** Get a single promotion by ID. */
  async getPromotionById(id: string): Promise<PromotionRecord | null> {
    return this.promotionRepo.findById(id);
  }

  /** Search promotions (admin). */
  async searchPromotions(query: PromotionQuery): Promise<PromotionRecord[]> {
    return this.promotionRepo.findAll(query);
  }
}
