import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RuleEngineService } from 'src/modules/rule-engine/rule-engine.service';
import { EligibilityEngineService } from 'src/modules/eligibility-engine/eligibility-engine.service';
import { BudgetEngineService } from 'src/modules/budget-engine/budget-engine.service';
import { EventEngineService } from 'src/modules/event-engine/event-engine.service';
import { AuditEngineService } from 'src/modules/audit-engine/audit-engine.service';
import {
  FilterContext,
  RuleDefinition,
  RuleEvaluationResult,
} from 'src/modules/rule-engine/rule-engine.types';
import { EligibilityCriteria } from 'src/modules/eligibility-engine/eligibility-engine.service';
import { BudgetReservation } from 'src/modules/budget-engine/budget-engine.service';
import { AuditEntry } from 'src/modules/audit-engine/audit-engine.service';
import { RewardEventPayload } from 'src/modules/event-engine/event-engine.service';
import { PrismaService } from 'src/common/services/prismaService';

import {
  PromotionRepositoryService,
  PromotionQuery,
  PromotionRecord,
} from '../promotion-repository.service';
import {
  ConflictResolverService,
  ConflictResolution,
  ConflictStrategy,
} from '../conflict-resolver.service';
import {
  DiscountEngineService,
  DiscountResult2,
  DiscountLine,
} from '../discount-engine.service';
import {
  CouponManagerService,
  CouponAllocation,
  CouponBlock,
  CouponClaim,
} from '../coupon-manager.service';
import {
  ClaimManagerService,
  ClaimInput,
  ClaimRecord,
  ClaimQuery,
} from '../claim-manager.service';
import { PromoEventPublisherService } from '../promo-event-publisher.service';
import {
  CouponValidatorService,
  CouponValidationInput,
} from '../coupon-validator.service';
import {
  SephoraResponseMapper,
  SephoraPromoResponse,
} from '../sephora-response.mapper';

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

export interface CouponCheckInput {
  organizationId: string;
  couponId?: string;
  couponCode?: string;
  customerId?: string;
  cartValue: number;
  currency?: string;
  cartCategories?: string[];
  isBankOffer?: boolean;
  channel?: string;
  context?: Record<string, any>;
}

export interface CouponCheckOutput {
  success: boolean;
  isApplicable: boolean;
  coupon_applicable_message: string;
  coupon_id: string;
  coupon_code: string;
  title: string;
  coupon_type: string;
  coupon_value: number;
  max_discount_value: number;
  minimum_cart_value: number;
  offer_text: string;
  coupon_amount: number;
  is_applied: boolean;
  expires_at: string;
  attributes: Record<string, any>;
  discount: {
    discounts: DiscountLine[];
    totalDiscount: number;
    finalAmount: number;
    wasCapped: boolean;
  };
  eligibility_reasons: string[];
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
    private readonly couponValidator: CouponValidatorService,
    private readonly responseMapper: SephoraResponseMapper,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Promotion CRUD ────────────────────────────────────────────

  async createPromotion(
    form: any,
    context: FilterContext,
    criteria: EligibilityCriteria,
    rules: RuleDefinition[],
    budgetReservation: BudgetReservation,
  ) {
    const eligibility = this.eligibilityEngine.evaluateEligibility(
      criteria,
      context,
    );
    const ruleResult = this.ruleEngine.evaluateRules(rules, context);
    const budgetResult = await this.budgetEngine.reserveBudget(
      budgetReservation,
    );

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

  async createAndPersistPromotion(organizationId: string, form: any) {
    const program = await this.prisma.rewardProgram.create({
      data: {
        organizationId,
        name: form.name,
        description: form.description ?? null,
        couponCode: form.couponCode ?? null,
        couponValue: form.couponValue ?? null,
        subTitle: form.subTitle ?? null,
        programType: 'PROMO',
        rewardType: form.rewardType ?? 'DISCOUNT',
        rewardCurrency: form.rewardCurrency ?? 'DEFAULT',
        budgetEnabled: false,
        priority: 0,
        minBankAmount: form.minBankAmount ?? null,
        minimumCartValue: form.minimumCartValue ?? null,
        maxDiscountValue: form.maxDiscountValue ?? null,
        businessType: form.businessType ?? [],
        maxClaimsPerUser: form.maxClaimsPerUser ?? null,
        maxClaimsTotal: form.maxClaimsTotal ?? null,
        attributes: form.attributes ?? null,
        channels: this.normalizeChannels(form.channels),
        startDate: form.validFrom ? new Date(form.validFrom) : new Date(),
        endDate: form.validTo ? new Date(form.validTo) : new Date(),
        status: 'ACTIVE',
        isArchived: false,
      },
    });

    return program;
  }

  async updatePromotion(id: string, form: any) {
    const program = await this.prisma.rewardProgram.update({
      where: { id },
      data: {
        name: form.name,
        description: form.description ?? null,
        couponCode: form.couponCode ?? null,
        couponValue: form.couponValue ?? null,
        subTitle: form.subTitle ?? null,
        rewardType: form.rewardType,
        minBankAmount: form.minBankAmount ?? null,
        minimumCartValue: form.minimumCartValue ?? null,
        maxDiscountValue: form.maxDiscountValue ?? null,
        businessType: form.businessType ?? [],
        maxClaimsPerUser: form.maxClaimsPerUser ?? null,
        maxClaimsTotal: form.maxClaimsTotal ?? null,
        attributes: form.attributes ?? null,
        channels: this.normalizeChannels(form.channels),
        startDate: form.validFrom ? new Date(form.validFrom) : undefined,
        endDate: form.validTo ? new Date(form.validTo) : undefined,
        status: form.status,
      },
    });
    return program;
  }

  async upsertRules(
    programId: string,
    rules: Array<{
      name: string;
      rewardType: string;
      rewardMode: string;
      value: number;
      conditions: any;
      threshold?: number;
      ratioBase?: number;
      meta?: any;
    }>,
  ) {
    await this.prisma.rewardProgramRule.deleteMany({ where: { programId } });
    const created = await Promise.all(
      rules.map((r) =>
        this.prisma.rewardProgramRule.create({
          data: {
            programId,
            name: r.name,
            rewardType: r.rewardType as any,
            rewardMode: r.rewardMode as any,
            value: r.value,
            conditions: r.conditions ?? { operator: 'AND', conditions: [] },
            threshold: r.threshold ?? null,
            ratioBase: r.ratioBase ?? null,
            meta: r.meta ?? null,
          },
        }),
      ),
    );
    return created;
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
  async evaluatePromotions(
    input: EvaluatePromotionsInput,
  ): Promise<EvaluatePromotionsOutput> {
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
          `Promotion ${promo.name} not eligible: ${eligibility.reasons.join(
            ', ',
          )}`,
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
        ? {
            amount: maxDiscountAmount ?? 0,
            percentage: maxDiscountPercentage ?? 0,
          }
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
  async releaseCoupon(
    blockId: string,
    reason?: string,
  ): Promise<CouponBlock | null> {
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
  async getCustomerCoupons(
    customerId: string,
    organizationId?: string,
  ): Promise<CouponBlock[]> {
    return this.couponManager.getCustomerCoupons(customerId, organizationId);
  }

  /** Get a specific coupon by block ID. */
  async getCoupon(
    blockId: string,
    organizationId?: string,
  ): Promise<CouponBlock | null> {
    return this.couponManager.getCoupon(blockId, organizationId);
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
  async revokeClaim(
    claimId: string,
    reason: string,
    actor?: string,
  ): Promise<ClaimRecord | null> {
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
  async getClaimById(
    id: string,
    organizationId?: string,
  ): Promise<ClaimRecord | null> {
    return this.claimManager.getClaimById(id, organizationId);
  }

  /** Get claim summary for a customer. */
  async getCustomerClaimSummary(customerId: string, organizationId?: string) {
    return this.claimManager.getCustomerClaimSummary(
      customerId,
      organizationId,
    );
  }

  // ─── Promotion Queries ─────────────────────────────────────────

  /** Get active promotions for an organization with Sephora-compatible response. */
  async getActivePromotions(
    organizationId: string,
    input?: CouponValidationInput,
  ): Promise<SephoraPromoResponse> {
    const page = (input as any)?.page ?? 1;
    const limit = (input as any)?.limit ?? 50;

    const promos = await this.prisma.rewardProgram.findMany({
      where: {
        organizationId,
        programType: 'PROMO',
        status: 'ACTIVE',
        isArchived: false,
      },
      include: { rules: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    });

    const validationInput: CouponValidationInput = {
      organizationId,
      customerId: input?.customerId,
      cartValue: input?.cartValue,
      cartCategories: input?.cartCategories,
      isBankOffer: input?.isBankOffer,
      channel: input?.channel,
      appliedCouponIds: input?.appliedCouponIds,
    };

    const validations = await this.couponValidator.validateAll(
      promos,
      validationInput,
    );

    return this.responseMapper.mapToResponse(promos, validations, page, limit);
  }

  // ─── Coupon Check on Cart ─────────────────────────────────────

  /**
   * Check a single coupon against customer eligibility and cart value.
   * Returns applicability plus the computed discount (final amount, cap).
   */
  async checkCouponOnCart(input: CouponCheckInput): Promise<CouponCheckOutput> {
    const couponLabel = input.couponCode
      ? `"${input.couponCode}"`
      : input.couponId;

    let promo: any = null;
    let codeRecord: any = null;

    // 0. Resolve the promotion either by id or by coupon code
    if (input.couponId) {
      promo = await this.prisma.rewardProgram.findUnique({
        where: { id: input.couponId },
        include: { rules: true },
      });
    } else if (input.couponCode) {
      promo = await this.prisma.rewardProgram.findFirst({
        where: { couponCode: input.couponCode, programType: 'PROMO' },
        include: { rules: true },
      });
      codeRecord = await this.prisma.couponCode.findUnique({
        where: { code: input.couponCode },
      });
      if (!promo && codeRecord) {
        const linked = await this.prisma.couponCode.findUnique({
          where: { code: input.couponCode },
          include: { program: { include: { rules: true } } },
        });
        promo = linked?.program ?? null;
      }
    }

    if (!promo || promo.programType !== 'PROMO') {
      throw new NotFoundException(`Coupon ${couponLabel} not found`);
    }

    // 1. Coupon-code level checks (usage, expiry, assignment)
    const codeReasons: string[] = [];
    if (codeRecord) {
      if (codeRecord.status === 'EXPIRED' || codeRecord.status === 'REVOKED') {
        codeReasons.push('This coupon code is no longer active');
      }
      if (codeRecord.expiresAt && new Date(codeRecord.expiresAt) < new Date()) {
        codeReasons.push('This coupon code has expired');
      }
      if (
        codeRecord.maxUses !== null &&
        codeRecord.usedCount >= codeRecord.maxUses
      ) {
        codeReasons.push('This coupon code has reached its usage limit');
      }
      if (codeRecord.isUserSpecific && codeRecord.customerId) {
        if (!input.customerId) {
          codeReasons.push('Customer ID is required for this coupon');
        } else if (codeRecord.customerId !== input.customerId) {
          codeReasons.push('This coupon code is not assigned to you');
        }
      }
    }

    // 2. Cart-level validation (status, expiry, min cart, bank, channel, categories)
    const validationInput: CouponValidationInput = {
      organizationId: input.organizationId,
      customerId: input.customerId,
      cartValue: input.cartValue,
      cartCategories: input.cartCategories,
      isBankOffer: input.isBankOffer,
      channel: input.channel,
    };
    const validation = await this.couponValidator.validate(
      promo,
      validationInput,
    );

    // 3. Customer eligibility (dates, blackout, working days, time slots, tiers, limits)
    const filterContext: FilterContext = {
      customerId: input.customerId,
      organizationId: input.organizationId,
      transactionAmount: input.cartValue,
      cartValue: input.cartValue,
      currency: input.currency ?? promo.rewardCurrency ?? 'INR',
      cartCategories: input.cartCategories,
      isBankOffer: input.isBankOffer,
      channel: input.channel,
      ...(input.context ?? {}),
    };
    const eligibility = this.eligibilityEngine.evaluateEligibility(
      {
        startDate: promo.startDate,
        endDate: promo.endDate,
        timezone: promo.timezone,
        blackoutDates: promo.blackoutDates ?? undefined,
        workingDays: promo.workingDays ?? undefined,
        dailyTimeSlots: promo.dailyTimeSlots ?? undefined,
      },
      filterContext,
    );

    // 4. Rule evaluation + discount computation
    const ruleResult = this.ruleEngine.evaluateRules(
      promo.rules ?? [],
      filterContext,
      input.cartValue,
    );

    const noRules = !promo.rules || promo.rules.length === 0;
    const ruleMatched = ruleResult.rulesMatched.length > 0 || noRules;

    // Promos without rules use their configured couponValue as a flat discount.
    const evaluation: RuleEvaluationResult =
      noRules && promo.couponValue
        ? {
            rulesMatched: [],
            totalAward: Number(promo.couponValue),
            awards: [
              {
                ruleId: promo.id,
                ruleName: promo.name,
                rewardType: promo.rewardType ?? 'DISCOUNT',
                rewardMode: 'ABSOLUTE',
                amount: Number(promo.couponValue),
                currency: input.currency ?? promo.rewardCurrency ?? 'INR',
              },
            ],
          }
        : ruleResult;

    const maxDiscount = promo.maxDiscountValue
      ? { amount: Number(promo.maxDiscountValue), percentage: 0 }
      : undefined;

    const discount = this.discountEngine.compute(
      input.cartValue,
      input.currency ?? 'INR',
      [evaluation],
      maxDiscount,
    );

    const isApplicable =
      codeReasons.length === 0 &&
      validation.isApplicable &&
      eligibility.eligible &&
      ruleMatched &&
      discount.totalDiscount > 0;

    const message =
      codeReasons[0] ??
      ((!validation.isApplicable ? validation.couponApplicableMessage : '') ||
        (!eligibility.eligible ? eligibility.reasons.join('; ') : '') ||
        (!ruleMatched ? 'Coupon does not match items in your cart' : '') ||
        'Coupon is applicable');

    return {
      success: true,
      isApplicable,
      coupon_applicable_message: message,
      coupon_id: promo.id,
      coupon_code:
        promo.couponCode ??
        input.couponCode ??
        promo.id.slice(0, 8).toUpperCase(),
      title: promo.name ?? '',
      coupon_type: this.responseMapper.mapCouponType(
        promo.rewardType ?? 'DISCOUNT',
      ),
      coupon_value: promo.couponValue ? Number(promo.couponValue) : 0,
      max_discount_value: promo.maxDiscountValue
        ? Number(promo.maxDiscountValue)
        : 0,
      minimum_cart_value: promo.minimumCartValue
        ? Number(promo.minimumCartValue)
        : 0,
      offer_text: this.responseMapper.buildOfferText(
        promo.rewardType ?? 'DISCOUNT',
        promo.couponValue ? Number(promo.couponValue) : 0,
        promo.rules ?? [],
      ),
      coupon_amount: promo.couponValue ? Number(promo.couponValue) : 0,
      is_applied: false,
      expires_at: promo.endDate ? new Date(promo.endDate).toISOString() : '',
      attributes: promo.attributes ?? {},
      discount: {
        discounts: discount.discounts,
        totalDiscount: discount.totalDiscount,
        finalAmount: discount.finalAmount,
        wasCapped: discount.wasCapped,
      },
      eligibility_reasons: eligibility.eligible ? [] : eligibility.reasons,
    };
  }

  /** Get a single promotion by ID. */
  async getPromotionById(id: string, organizationId?: string): Promise<any> {
    return this.prisma.rewardProgram.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
      include: { rules: true },
    });
  }

  /** List promotions in raw RewardProgram shape for the admin dashboard. */
  async listPromotions(organizationId?: string): Promise<any[]> {
    return this.prisma.rewardProgram.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        programType: 'PROMO',
      },
      include: { rules: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /** Search promotions (admin). */
  async searchPromotions(query: PromotionQuery): Promise<PromotionRecord[]> {
    return this.promotionRepo.findAll(query);
  }

  /** Normalize lowercase channel names to Prisma Channel enum values. */
  private normalizeChannels(channels?: string[]): any[] {
    if (!channels || channels.length === 0) return [];
    const map: Record<string, string> = {
      app: 'APP',
      web: 'WEB',
      mweb: 'MWEB',
      all: 'ALL',
    };
    return channels.map((c) => map[c.toLowerCase()] ?? c.toUpperCase());
  }
}
