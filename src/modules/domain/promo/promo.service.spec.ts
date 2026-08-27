import { Test, TestingModule } from '@nestjs/testing';
import { PromoService, EvaluatePromotionsInput } from './promo.service';
import { RuleEngineService } from 'src/modules/core/rule-engine/rule-engine.service';
import { EligibilityEngineService } from 'src/modules/core/eligibility-engine/eligibility-engine.service';
import { BudgetEngineService } from 'src/modules/core/budget-engine/budget-engine.service';
import { EventEngineService } from 'src/modules/core/event-engine/event-engine.service';
import { AuditEngineService } from 'src/modules/core/audit-engine/audit-engine.service';
import { PromotionRepositoryService, PromotionRecord } from './promotion-repository.service';
import { ConflictResolverService } from './conflict-resolver.service';
import { DiscountEngineService } from './discount-engine.service';
import { CouponManagerService, CouponBlock } from './coupon-manager.service';
import { ClaimManagerService, ClaimRecord } from './claim-manager.service';
import { PromoEventPublisherService } from './promo-event-publisher.service';
import { CouponValidatorService } from './coupon-validator.service';
import { SephoraResponseMapper } from './sephora-response.mapper';
import { PrismaService } from 'src/common/services/prismaService';

describe('PromoService', () => {
  let service: PromoService;
  let promotionRepo: jest.Mocked<PromotionRepositoryService>;
  let conflictResolver: jest.Mocked<ConflictResolverService>;
  let discountEngine: jest.Mocked<DiscountEngineService>;
  let couponManager: jest.Mocked<CouponManagerService>;
  let claimManager: jest.Mocked<ClaimManagerService>;
  let promoEvents: jest.Mocked<PromoEventPublisherService>;
  let ruleEngine: jest.Mocked<RuleEngineService>;
  let eligibilityEngine: jest.Mocked<EligibilityEngineService>;
  let budgetEngine: jest.Mocked<BudgetEngineService>;
  let eventEngine: jest.Mocked<EventEngineService>;
  let auditEngine: jest.Mocked<AuditEngineService>;
  let prisma: { rewardProgram: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock } };

  const mockPromotion: PromotionRecord = {
    id: 'promo-1',
    organizationId: 'org-1',
    name: 'Summer Sale',
    description: '10% off on electronics',
    programType: 'PROMO',
    rewardType: 'DISCOUNT',
    status: 'ACTIVE',
    rewardCurrency: 'INR',
    budgetEnabled: true,
    priority: 10,
    business: 'electronics',
    category: 'phones',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-12-31'),
    timezone: 'UTC',
    blackoutDates: null,
    workingDays: null,
    dailyTimeSlots: null,
    version: 1,
    rules: [
      {
        id: 'rule-1',
        name: '10% Off',
        conditions: { operator: 'AND', conditions: [] },
        rewardType: 'DISCOUNT',
        rewardMode: 'PERCENTAGE',
        value: 10,
        priority: 10,
      },
    ],
  };

  const mockCoupon: CouponBlock = {
    blockId: 'CPN-prog1-cust1-123',
    programId: 'prog-1',
    customerId: 'cust-1',
    couponCode: 'SAVE10',
    discountAmount: 100,
    currency: 'INR',
    status: 'BLOCKED',
  };

  const mockClaim: ClaimRecord = {
    id: 'clm-1',
    customerId: 'cust-1',
    programId: 'prog-1',
    rewardType: 'COUPON',
    amount: 100,
    currency: 'INR',
    transactionRef: 'txn-123',
    status: 'CONFIRMED',
    details: {},
    claimedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromoService,
        {
          provide: RuleEngineService,
          useFactory: () => ({
            evaluateRules: jest.fn().mockReturnValue({
              rulesMatched: [{ ruleId: 'rule-1', ruleName: '10% Off' }],
              awards: [{ ruleId: 'rule-1', ruleName: '10% Off', amount: 50, rewardMode: 'PERCENTAGE' }],
              totalAward: 50,
            }),
          }),
        },
        {
          provide: EligibilityEngineService,
          useFactory: () => ({
            evaluateEligibility: jest.fn().mockReturnValue({ eligible: true, reasons: [] }),
          }),
        },
        {
          provide: BudgetEngineService,
          useFactory: () => ({
            reserveBudget: jest.fn().mockResolvedValue({
              reserved: true,
              remainingBudget: 9500,
              totalBudget: 10000,
              usedBudget: 0,
            }),
          }),
        },
        {
          provide: EventEngineService,
          useFactory: () => ({
            publish: jest.fn(),
          }),
        },
        {
          provide: AuditEngineService,
          useFactory: () => ({
            log: jest.fn().mockResolvedValue(undefined),
          }),
        },
        {
          provide: PromotionRepositoryService,
          useFactory: () => ({
            findActive: jest.fn().mockResolvedValue([mockPromotion]),
            findById: jest.fn().mockResolvedValue(mockPromotion),
            findAll: jest.fn().mockResolvedValue([mockPromotion]),
          }),
        },
        {
          provide: ConflictResolverService,
          useFactory: () => ({
            resolve: jest.fn().mockReturnValue({
              winners: [mockPromotion],
              excluded: [],
              resolvedAwards: [
                { rulesMatched: [{ ruleId: 'rule-1' }], awards: [{ ruleId: 'rule-1', amount: 50 }], totalAward: 50 },
              ],
            }),
          }),
        },
        {
          provide: DiscountEngineService,
          useFactory: () => ({
            compute: jest.fn().mockReturnValue({
              discounts: [{ ruleId: 'rule-1', discountAmount: 50, discountPercentage: 10 }],
              totalDiscount: 50,
              finalAmount: 450,
              wasCapped: false,
            }),
          }),
        },
        {
          provide: CouponManagerService,
          useFactory: () => ({
            allocate: jest.fn().mockResolvedValue(mockCoupon),
            block: jest.fn().mockResolvedValue(mockCoupon),
            release: jest.fn().mockResolvedValue({ ...mockCoupon, status: 'RELEASED' }),
            claim: jest.fn().mockResolvedValue({ ...mockCoupon, status: 'CLAIMED' }),
            getCustomerCoupons: jest.fn().mockResolvedValue([mockCoupon]),
            getCoupon: jest.fn().mockResolvedValue(mockCoupon),
          }),
        },
        {
          provide: ClaimManagerService,
          useFactory: () => ({
            recordClaim: jest.fn().mockResolvedValue(mockClaim),
            revokeClaim: jest.fn().mockResolvedValue({ ...mockClaim, status: 'REVOKED' }),
            getClaims: jest.fn().mockResolvedValue([mockClaim]),
            getClaimById: jest.fn().mockResolvedValue(mockClaim),
            getCustomerClaimSummary: jest.fn().mockResolvedValue({
              totalClaimed: 500,
              totalReversed: 50,
              claimCount: 5,
            }),
          }),
        },
        {
          provide: PromoEventPublisherService,
          useFactory: () => ({
            emitPromotionEvaluated: jest.fn(),
            emitConflictResolved: jest.fn(),
            emitDiscountComputed: jest.fn(),
            emitCouponAllocated: jest.fn(),
            emitCouponBlocked: jest.fn(),
            emitCouponReleased: jest.fn(),
            emitCouponClaimed: jest.fn(),
            emitClaimRecorded: jest.fn(),
            emitClaimRevoked: jest.fn(),
          }),
        },
        {
          provide: CouponValidatorService,
          useFactory: () => ({
            validate: jest.fn().mockResolvedValue({ isApplicable: true, isApplied: false, couponApplicableMessage: '' }),
            validateAll: jest.fn().mockResolvedValue(new Map()),
            addRule: jest.fn(),
          }),
        },
        {
          provide: SephoraResponseMapper,
          useFactory: () => ({
            mapToResponse: jest.fn().mockReturnValue({ available_coupon_list: [], page: { current: 1, total: 1, has_previous: false, has_next: false, total_item_count: 0 } }),
            mapPromoToCoupon: jest.fn().mockReturnValue({}),
            mapCouponType: jest.fn().mockReturnValue('absolute'),
            formatExpiryDate: jest.fn().mockReturnValue(''),
            buildOfferText: jest.fn().mockReturnValue(''),
          }),
        },
        {
          provide: PrismaService,
          useFactory: () => ({
            rewardProgram: {
              create: jest.fn().mockResolvedValue({ id: 'promo-new', name: 'New Promo' }),
              update: jest.fn().mockResolvedValue({ id: 'promo-1', name: 'Updated' }),
              findUnique: jest.fn().mockResolvedValue(null),
              findMany: jest.fn().mockResolvedValue([]),
            },
            rewardProgramRule: {
              create: jest.fn().mockResolvedValue({ id: 'rule-new' }),
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
          }),
        },
      ],
    }).compile();

    service = module.get<PromoService>(PromoService);
    promotionRepo = module.get(PromotionRepositoryService);
    conflictResolver = module.get(ConflictResolverService);
    discountEngine = module.get(DiscountEngineService);
    couponManager = module.get(CouponManagerService);
    claimManager = module.get(ClaimManagerService);
    promoEvents = module.get(PromoEventPublisherService);
    ruleEngine = module.get(RuleEngineService);
    eligibilityEngine = module.get(EligibilityEngineService);
    budgetEngine = module.get(BudgetEngineService);
    eventEngine = module.get(EventEngineService);
    auditEngine = module.get(AuditEngineService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluatePromotions', () => {
    const input: EvaluatePromotionsInput = {
      organizationId: 'org-1',
      customerId: 'cust-1',
      transactionAmount: 500,
      currency: 'INR',
      transactionRef: 'txn-123',
    };

    it('should return success with evaluated promotions', async () => {
      const result = await service.evaluatePromotions(input);

      expect(result.success).toBe(true);
      expect(result.transactionRef).toBe('txn-123');
      expect(result.eligiblePromotions).toBeGreaterThanOrEqual(0);
    });

    it('should return empty result when no active promotions exist', async () => {
      promotionRepo.findActive.mockResolvedValue([]);

      const result = await service.evaluatePromotions(input);

      expect(result.success).toBe(true);
      expect(result.eligiblePromotions).toBe(0);
      expect(result.discount.totalDiscount).toBe(0);
      expect(result.discount.finalAmount).toBe(500);
      expect(conflictResolver.resolve).not.toHaveBeenCalled();
    });

    it('should filter out ineligible promotions', () => {
      eligibilityEngine.evaluateEligibility.mockReturnValue({
        eligible: false,
        reasons: ['Program has ended'],
      });

      return service.evaluatePromotions(input).then((result) => {
        expect(ruleEngine.evaluateRules).not.toHaveBeenCalled();
        expect(result.eligiblePromotions).toBe(0);
      });
    });

    it('should load active promotions from repository', async () => {
      await service.evaluatePromotions(input);

      expect(promotionRepo.findActive).toHaveBeenCalledWith({
        organizationId: 'org-1',
        programType: 'PROMO',
      });
    });

    it('should resolve conflicts among eligible promotions', async () => {
      await service.evaluatePromotions(input);

      expect(conflictResolver.resolve).toHaveBeenCalled();
      expect(promoEvents.emitConflictResolved).toHaveBeenCalled();
    });

    it('should compute discounts from resolved awards', async () => {
      await service.evaluatePromotions(input);

      expect(discountEngine.compute).toHaveBeenCalledWith(
        500,
        'INR',
        expect.any(Array),
        undefined,
      );
      expect(promoEvents.emitDiscountComputed).toHaveBeenCalled();
    });

    it('should reserve budget for winning promotions with budget enabled', async () => {
      await service.evaluatePromotions(input);

      expect(budgetEngine.reserveBudget).toHaveBeenCalled();
    });

    it('should log audit entry with evaluation details', async () => {
      await service.evaluatePromotions(input);

      expect(auditEngine.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'evaluatePromotions',
          entityType: 'Promotion',
        }),
      );
    });
  });

  describe('createPromotion', () => {
    it('should create promotion and return success', async () => {
      const form = { name: 'New Promo', description: 'Test' };
      const context = { customerId: 'cust-1', organizationId: 'org-1' };
      const criteria = { startDate: new Date(), endDate: new Date() };
      const rules = [{ id: 'r1', name: 'Rule', conditions: { operator: 'AND' as const, conditions: [] }, rewardType: 'DISCOUNT', rewardMode: 'ABSOLUTE' as const, value: 10, priority: 1 }] as any[];
      const budgetReservation = { programId: 'prog-1', amount: 100, currency: 'INR', reference: 'ref-1' };

      const result = await service.createPromotion(form, context, criteria, rules, budgetReservation);

      expect(result.success).toBe(true);
      expect(result.promotion).toEqual(form);
      expect(auditEngine.log).toHaveBeenCalled();
      expect(eventEngine.publish).toHaveBeenCalled();
    });
  });

  describe('coupon operations', () => {
    it('should allocate a coupon', async () => {
      const allocation = {
        programId: 'prog-1',
        customerId: 'cust-1',
        couponCode: 'SAVE10',
        discountAmount: 100,
        currency: 'INR',
      };

      const result = await service.allocateCoupon(allocation);

      expect(result.blockId).toBeDefined();
      expect(couponManager.allocate).toHaveBeenCalledWith(allocation);
      expect(promoEvents.emitCouponAllocated).toHaveBeenCalled();
    });

    it('should block a coupon', async () => {
      const result = await service.blockCoupon('CPN-prog1-cust1-123');

      expect(result).toBeDefined();
      expect(couponManager.block).toHaveBeenCalledWith('CPN-prog1-cust1-123');
      expect(promoEvents.emitCouponBlocked).toHaveBeenCalled();
    });

    it('should return null when blocking non-existent coupon', async () => {
      couponManager.block.mockResolvedValue(null);

      const result = await service.blockCoupon('non-existent');

      expect(result).toBeNull();
      expect(promoEvents.emitCouponBlocked).not.toHaveBeenCalled();
    });

    it('should release a coupon', async () => {
      const released = { ...mockCoupon, status: 'RELEASED' as const };
      couponManager.release.mockResolvedValue(released);

      const result = await service.releaseCoupon('block-1', 'customer request');

      expect(result).toBeDefined();
      expect(couponManager.release).toHaveBeenCalledWith('block-1', 'customer request');
      expect(promoEvents.emitCouponReleased).toHaveBeenCalled();
    });

    it('should claim a coupon', async () => {
      const claimed = { ...mockCoupon, status: 'CLAIMED' as const };
      couponManager.claim.mockResolvedValue(claimed);

      const claim = {
        blockId: 'CPN-prog1-cust1-123',
        customerId: 'cust-1',
        couponCode: 'SAVE10',
        transactionRef: 'txn-123',
        claimedAmount: 100,
      };

      const result = await service.claimCoupon(claim);

      expect(result).toBeDefined();
      expect(couponManager.claim).toHaveBeenCalledWith(claim);
      expect(promoEvents.emitCouponClaimed).toHaveBeenCalled();
      expect(auditEngine.log).toHaveBeenCalled();
    });

    it('should return customer coupons', async () => {
      const result = await service.getCustomerCoupons('cust-1');

      expect(result).toEqual([mockCoupon]);
      expect(couponManager.getCustomerCoupons).toHaveBeenCalledWith('cust-1');
    });

    it('should return coupon by block ID', async () => {
      const result = await service.getCoupon('CPN-prog1-cust1-123');

      expect(result).toEqual(mockCoupon);
      expect(couponManager.getCoupon).toHaveBeenCalledWith('CPN-prog1-cust1-123');
    });
  });

  describe('claim operations', () => {
    it('should record a claim', async () => {
      const input = {
        customerId: 'cust-1',
        programId: 'prog-1',
        rewardType: 'COUPON',
        amount: 100,
        currency: 'INR',
        transactionRef: 'txn-123',
      };

      const result = await service.recordClaim(input);

      expect(result.id).toBe('clm-1');
      expect(claimManager.recordClaim).toHaveBeenCalledWith(input);
      expect(promoEvents.emitClaimRecorded).toHaveBeenCalled();
      expect(auditEngine.log).toHaveBeenCalled();
    });

    it('should revoke a claim', async () => {
      const revoked = { ...mockClaim, status: 'REVOKED' as const };
      claimManager.revokeClaim.mockResolvedValue(revoked);

      const result = await service.revokeClaim('clm-1', 'Customer refund', 'admin');

      expect(result).toBeDefined();
      expect(claimManager.revokeClaim).toHaveBeenCalledWith('clm-1', 'Customer refund', 'admin');
      expect(promoEvents.emitClaimRevoked).toHaveBeenCalled();
    });

    it('should return null when revoking non-existent claim', async () => {
      claimManager.revokeClaim.mockResolvedValue(null);

      const result = await service.revokeClaim('non-existent', 'reason');

      expect(result).toBeNull();
    });

    it('should get claim by ID', async () => {
      const result = await service.getClaimById('clm-1');

      expect(result).toEqual(mockClaim);
      expect(claimManager.getClaimById).toHaveBeenCalledWith('clm-1');
    });

    it('should get customer claim summary', async () => {
      const result = await service.getCustomerClaimSummary('cust-1');

      expect(result).toEqual({ totalClaimed: 500, totalReversed: 50, claimCount: 5 });
      expect(claimManager.getCustomerClaimSummary).toHaveBeenCalledWith('cust-1');
    });
  });

  describe('promotion queries', () => {
    it('should get active promotions', async () => {
      prisma.rewardProgram.findMany.mockResolvedValue([mockPromotion] as any);
      const result = await service.getActivePromotions('org-1');

      expect(result).toHaveProperty('available_coupon_list');
      expect(result).toHaveProperty('page');
      expect(prisma.rewardProgram.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1', programType: 'PROMO' }),
          include: { rules: true },
        }),
      );
    });

    it('should get promotion by ID', async () => {
      prisma.rewardProgram.findUnique.mockResolvedValue(mockPromotion as any);
      const result = await service.getPromotionById('promo-1');

      expect(result).toEqual(mockPromotion);
      expect(prisma.rewardProgram.findUnique).toHaveBeenCalledWith({
        where: { id: 'promo-1' },
        include: { rules: true },
      });
    });

    it('should search promotions', async () => {
      const result = await service.searchPromotions({ organizationId: 'org-1' });

      expect(result).toEqual([mockPromotion]);
      expect(promotionRepo.findAll).toHaveBeenCalled();
    });
  });
});
