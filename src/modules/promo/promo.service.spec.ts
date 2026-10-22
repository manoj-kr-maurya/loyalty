import { Test, TestingModule } from '@nestjs/testing';
import {
  PromoService,
  EvaluatePromotionsInput,
  CouponCheckInput,
} from './promo.service';
import { RuleEngineService } from 'src/modules/rule-engine/rule-engine.service';
import { EligibilityEngineService } from 'src/modules/eligibility-engine/eligibility-engine.service';
import { BudgetEngineService } from 'src/modules/budget-engine/budget-engine.service';
import { EventEngineService } from 'src/modules/event-engine/event-engine.service';
import { AuditEngineService } from 'src/modules/audit-engine/audit-engine.service';
import {
  PromotionRepositoryService,
  PromotionRecord,
} from './promotion-repository.service';
import { ConflictResolverService } from './conflict-resolver.service';
import { DiscountEngineService } from './discount-engine.service';
import { CouponManagerService, CouponBlock } from './coupon-manager.service';
import { ClaimManagerService, ClaimRecord } from './claim-manager.service';
import { PromoEventPublisherService } from './promo-event-publisher.service';
import { CouponValidatorService } from './coupon-validator.service';
import { SephoraResponseMapper } from './sephora-response.mapper';
import { PrismaService } from 'src/common/services/prismaService';
import { NotFoundException } from '@nestjs/common';

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
  let couponValidator: jest.Mocked<CouponValidatorService>;
  let responseMapper: jest.Mocked<SephoraResponseMapper>;
  let prisma: {
    rewardProgram: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    couponCode: { findUnique: jest.Mock };
  };

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
              awards: [
                {
                  ruleId: 'rule-1',
                  ruleName: '10% Off',
                  amount: 50,
                  rewardMode: 'PERCENTAGE',
                },
              ],
              totalAward: 50,
            }),
          }),
        },
        {
          provide: EligibilityEngineService,
          useFactory: () => ({
            evaluateEligibility: jest
              .fn()
              .mockReturnValue({ eligible: true, reasons: [] }),
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
                {
                  rulesMatched: [{ ruleId: 'rule-1' }],
                  awards: [{ ruleId: 'rule-1', amount: 50 }],
                  totalAward: 50,
                },
              ],
            }),
          }),
        },
        {
          provide: DiscountEngineService,
          useFactory: () => ({
            compute: jest.fn().mockReturnValue({
              discounts: [
                {
                  ruleId: 'rule-1',
                  discountAmount: 50,
                  discountPercentage: 10,
                },
              ],
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
            release: jest
              .fn()
              .mockResolvedValue({ ...mockCoupon, status: 'RELEASED' }),
            claim: jest
              .fn()
              .mockResolvedValue({ ...mockCoupon, status: 'CLAIMED' }),
            getCustomerCoupons: jest.fn().mockResolvedValue([mockCoupon]),
            getCoupon: jest.fn().mockResolvedValue(mockCoupon),
          }),
        },
        {
          provide: ClaimManagerService,
          useFactory: () => ({
            recordClaim: jest.fn().mockResolvedValue(mockClaim),
            revokeClaim: jest
              .fn()
              .mockResolvedValue({ ...mockClaim, status: 'REVOKED' }),
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
            validate: jest.fn().mockResolvedValue({
              isApplicable: true,
              isApplied: false,
              couponApplicableMessage: '',
            }),
            validateAll: jest.fn().mockResolvedValue(new Map()),
            addRule: jest.fn(),
          }),
        },
        {
          provide: SephoraResponseMapper,
          useFactory: () => ({
            mapToResponse: jest.fn().mockReturnValue({
              available_coupon_list: [],
              page: {
                current: 1,
                total: 1,
                has_previous: false,
                has_next: false,
                total_item_count: 0,
              },
            }),
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
              create: jest
                .fn()
                .mockResolvedValue({ id: 'promo-new', name: 'New Promo' }),
              update: jest
                .fn()
                .mockResolvedValue({ id: 'promo-1', name: 'Updated' }),
              findUnique: jest.fn().mockResolvedValue(null),
              findFirst: jest.fn().mockResolvedValue(null),
              findMany: jest.fn().mockResolvedValue([]),
            },
            couponCode: {
              findUnique: jest.fn().mockResolvedValue(null),
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
    couponValidator = module.get(CouponValidatorService);
    responseMapper = module.get(SephoraResponseMapper);
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
      const rules = [
        {
          id: 'r1',
          name: 'Rule',
          conditions: { operator: 'AND' as const, conditions: [] },
          rewardType: 'DISCOUNT',
          rewardMode: 'ABSOLUTE' as const,
          value: 10,
          priority: 1,
        },
      ] as any[];
      const budgetReservation = {
        programId: 'prog-1',
        amount: 100,
        currency: 'INR',
        reference: 'ref-1',
      };

      const result = await service.createPromotion(
        form,
        context,
        criteria,
        rules,
        budgetReservation,
      );

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
      expect(couponManager.release).toHaveBeenCalledWith(
        'block-1',
        'customer request',
      );
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
      expect(couponManager.getCoupon).toHaveBeenCalledWith(
        'CPN-prog1-cust1-123',
      );
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

      const result = await service.revokeClaim(
        'clm-1',
        'Customer refund',
        'admin',
      );

      expect(result).toBeDefined();
      expect(claimManager.revokeClaim).toHaveBeenCalledWith(
        'clm-1',
        'Customer refund',
        'admin',
      );
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

      expect(result).toEqual({
        totalClaimed: 500,
        totalReversed: 50,
        claimCount: 5,
      });
      expect(claimManager.getCustomerClaimSummary).toHaveBeenCalledWith(
        'cust-1',
      );
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
          where: expect.objectContaining({
            organizationId: 'org-1',
            programType: 'PROMO',
          }),
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
      const result = await service.searchPromotions({
        organizationId: 'org-1',
      });

      expect(result).toEqual([mockPromotion]);
      expect(promotionRepo.findAll).toHaveBeenCalled();
    });
  });

  describe('checkCouponOnCart', () => {
    const cartPromo: any = {
      id: 'promo-cart',
      organizationId: 'org-1',
      name: 'Flat ₹100 Off',
      programType: 'PROMO',
      rewardType: 'DISCOUNT',
      rewardCurrency: 'INR',
      status: 'ACTIVE',
      isArchived: false,
      couponCode: 'SAVE100',
      couponValue: 100,
      minimumCartValue: 500,
      maxDiscountValue: 100,
      businessType: [],
      channels: ['APP'],
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
      timezone: 'UTC',
      blackoutDates: null,
      workingDays: null,
      dailyTimeSlots: null,
      rules: [],
    };

    const input: CouponCheckInput = {
      organizationId: 'org-1',
      couponCode: 'SAVE100',
      customerId: 'cust-1',
      cartValue: 1000,
      currency: 'INR',
      channel: 'app',
    };

    const availableCodeRecord = {
      id: 'cc-1',
      code: 'SAVE100',
      programId: 'promo-cart',
      isUserSpecific: true,
      customerId: 'cust-1',
      status: 'AVAILABLE',
      usedCount: 0,
      maxUses: 1,
    };

    const defaultDiscount = {
      discounts: [
        {
          ruleId: 'promo-cart',
          ruleName: 'Flat ₹100 Off',
          rewardType: 'DISCOUNT',
          discountAmount: 100,
          discountPercentage: 10,
          currency: 'INR',
          description: '',
        },
      ],
      totalDiscount: 100,
      finalAmount: 900,
      wasCapped: false,
    };

    // ─── Lookup / Resolution ─────────────────────────────────────

    it('should return applicability and computed discount for an applicable coupon', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      discountEngine.compute.mockReturnValue(defaultDiscount as any);

      const result = await service.checkCouponOnCart(input);

      expect(result.success).toBe(true);
      expect(result.isApplicable).toBe(true);
      expect(result.coupon_code).toBe('SAVE100');
      expect(result.coupon_id).toBe('promo-cart');
      expect(result.coupon_type).toBe('absolute');
      expect(result.discount.totalDiscount).toBe(100);
      expect(result.discount.finalAmount).toBe(900);
      expect(result.discount.wasCapped).toBe(false);
      expect(result.eligibility_reasons).toEqual([]);
      // Exact query shape used for a couponCode lookup
      expect(prisma.rewardProgram.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            couponCode: 'SAVE100',
            programType: 'PROMO',
          },
          include: { rules: true },
        }),
      );
    });

    it('should look up the promotion by couponId when couponId is provided', async () => {
      prisma.rewardProgram.findUnique.mockResolvedValue(cartPromo);
      discountEngine.compute.mockReturnValue(defaultDiscount as any);

      const result = await service.checkCouponOnCart({
        ...input,
        couponCode: undefined,
        couponId: 'promo-cart',
      });

      expect(result.isApplicable).toBe(true);
      expect(prisma.rewardProgram.findUnique).toHaveBeenCalledWith({
        where: { id: 'promo-cart' },
        include: { rules: true },
      });
      expect(prisma.rewardProgram.findFirst).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the coupon does not exist', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(null);
      prisma.couponCode.findUnique.mockResolvedValue(null);

      await expect(
        service.checkCouponOnCart({ ...input, couponCode: 'INVALID' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the program type is not PROMO', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(null);
      prisma.couponCode.findUnique.mockResolvedValue(null);
      prisma.rewardProgram.findUnique.mockResolvedValue({
        ...cartPromo,
        programType: 'GIFT',
      });

      await expect(
        service.checkCouponOnCart({
          ...input,
          couponCode: undefined,
          couponId: 'promo-gift',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should resolve coupon through the linked couponCode record when no direct promo match exists', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(null);
      prisma.couponCode.findUnique
        .mockResolvedValueOnce({
          ...availableCodeRecord,
          code: 'LINKED10',
        })
        .mockResolvedValueOnce({
          ...availableCodeRecord,
          code: 'LINKED10',
          program: { ...cartPromo, couponCode: 'LINKED10' },
        });
      discountEngine.compute.mockReturnValue(defaultDiscount as any);

      const result = await service.checkCouponOnCart({
        ...input,
        couponCode: 'LINKED10',
      });

      expect(result.isApplicable).toBe(true);
      expect(result.coupon_id).toBe('promo-cart');
      expect(prisma.couponCode.findUnique).toHaveBeenCalledTimes(2);
    });

    // ─── Coupon-code level checks ────────────────────────────────

    it('should mark coupon as not applicable when customer not assigned', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue({
        ...availableCodeRecord,
        customerId: 'cust-2',
      });

      const result = await service.checkCouponOnCart(input);

      expect(result.isApplicable).toBe(false);
      expect(result.coupon_applicable_message).toContain('not assigned');
    });

    it('should mark coupon as not applicable when code status is EXPIRED', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue({
        ...availableCodeRecord,
        status: 'EXPIRED',
      });

      const result = await service.checkCouponOnCart(input);

      expect(result.isApplicable).toBe(false);
      expect(result.coupon_applicable_message).toContain('no longer active');
    });

    it('should mark coupon as not applicable when code status is REVOKED', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue({
        ...availableCodeRecord,
        status: 'REVOKED',
      });

      const result = await service.checkCouponOnCart(input);

      expect(result.isApplicable).toBe(false);
      expect(result.coupon_applicable_message).toContain('no longer active');
    });

    it('should mark coupon as not applicable when code has expired (expiresAt)', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue({
        ...availableCodeRecord,
        expiresAt: new Date('2020-01-01'),
      });

      const result = await service.checkCouponOnCart(input);

      expect(result.isApplicable).toBe(false);
      expect(result.coupon_applicable_message).toContain('expired');
    });

    it('should mark coupon as not applicable when usage limit reached', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue({
        ...availableCodeRecord,
        usedCount: 1,
        maxUses: 1,
      });

      const result = await service.checkCouponOnCart(input);

      expect(result.isApplicable).toBe(false);
      expect(result.coupon_applicable_message).toContain('usage limit');
    });

    it('should mark coupon as not applicable when customer ID is required but missing', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue({
        ...availableCodeRecord,
        isUserSpecific: true,
        customerId: 'cust-1',
      });

      const result = await service.checkCouponOnCart({
        ...input,
        customerId: undefined,
      });

      expect(result.isApplicable).toBe(false);
      expect(result.coupon_applicable_message).toContain(
        'Customer ID is required',
      );
    });

    it('should use the first code-level reason as the message when multiple apply', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue({
        ...availableCodeRecord,
        status: 'EXPIRED',
        expiresAt: new Date('2020-01-01'),
        usedCount: 5,
        maxUses: 1,
      });

      const result = await service.checkCouponOnCart(input);

      expect(result.isApplicable).toBe(false);
      expect(result.coupon_applicable_message).toBe(
        'This coupon code is no longer active',
      );
    });

    it('should ignore code-level checks when no code record exists', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue(null);
      discountEngine.compute.mockReturnValue(defaultDiscount as any);

      const result = await service.checkCouponOnCart(input);

      expect(result.isApplicable).toBe(true);
    });

    // ─── Cart-level validation (CouponValidator) ────────────────

    it('should mark coupon as not applicable when cart-level validation fails', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      couponValidator.validate.mockResolvedValue({
        isApplicable: false,
        isApplied: false,
        couponApplicableMessage: 'This is a bank-specific offer',
      });

      const result = await service.checkCouponOnCart(input);

      expect(result.isApplicable).toBe(false);
      expect(result.coupon_applicable_message).toBe(
        'This is a bank-specific offer',
      );
    });

    it('should pass the correct validation input to CouponValidator', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      discountEngine.compute.mockReturnValue(defaultDiscount as any);

      await service.checkCouponOnCart({
        ...input,
        cartCategories: ['electronics'],
        isBankOffer: true,
      });

      expect(couponValidator.validate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'promo-cart' }),
        {
          organizationId: 'org-1',
          customerId: 'cust-1',
          cartValue: 1000,
          cartCategories: ['electronics'],
          isBankOffer: true,
          channel: 'app',
        },
      );
    });

    // ─── Customer eligibility (EligibilityEngine) ────────────────

    it('should mark coupon as not applicable when the customer is not eligible', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      eligibilityEngine.evaluateEligibility.mockReturnValue({
        eligible: false,
        reasons: ['Program has ended'],
      });

      const result = await service.checkCouponOnCart(input);

      expect(result.isApplicable).toBe(false);
      expect(result.coupon_applicable_message).toBe('Program has ended');
      expect(result.eligibility_reasons).toEqual(['Program has ended']);
    });

    it('should pass campaign criteria and filter context to EligibilityEngine', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      discountEngine.compute.mockReturnValue(defaultDiscount as any);

      await service.checkCouponOnCart(input);

      expect(eligibilityEngine.evaluateEligibility).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: cartPromo.startDate,
          endDate: cartPromo.endDate,
        }),
        expect.objectContaining({
          customerId: 'cust-1',
          organizationId: 'org-1',
          transactionAmount: 1000,
          currency: 'INR',
        }),
      );
    });

    // ─── Rule evaluation + discount computation ─────────────────

    it('should apply couponValue as a flat discount when the promo has no rules', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue({
        ...cartPromo,
        rules: [],
      });
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      discountEngine.compute.mockReturnValue(defaultDiscount as any);

      const result = await service.checkCouponOnCart(input);

      expect(result.isApplicable).toBe(true);
      expect(result.discount.totalDiscount).toBe(100);
      // no-rules promo with couponValue → RuleEngine result is bypassed
      expect(discountEngine.compute).toHaveBeenCalledWith(
        1000,
        'INR',
        expect.arrayContaining([
          expect.objectContaining({
            totalAward: 100,
            awards: [
              expect.objectContaining({
                ruleId: 'promo-cart',
                rewardMode: 'ABSOLUTE',
                amount: 100,
              }),
            ],
          }),
        ]),
        expect.any(Object),
      );
    });

    it('should mark coupon as not applicable when rules exist but none match the cart', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue({
        ...cartPromo,
        rules: [
          {
            id: 'rule-1',
            name: 'Electronics Only',
            rewardType: 'DISCOUNT',
            rewardMode: 'PERCENTAGE',
            value: 10,
          },
        ],
      });
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      ruleEngine.evaluateRules.mockReturnValue({
        rulesMatched: [],
        awards: [],
        totalAward: 0,
      });
      discountEngine.compute.mockReturnValue({
        ...defaultDiscount,
        totalDiscount: 0,
        finalAmount: 1000,
      });

      const result = await service.checkCouponOnCart(input);

      expect(result.isApplicable).toBe(false);
      expect(result.coupon_applicable_message).toBe(
        'Coupon does not match items in your cart',
      );
    });

    it('should mark coupon as not applicable when the computed discount is zero', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue({
        ...cartPromo,
        couponValue: 0,
        rules: [],
      });
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      discountEngine.compute.mockReturnValue({
        ...defaultDiscount,
        discounts: [],
        totalDiscount: 0,
        finalAmount: 1000,
      });

      const result = await service.checkCouponOnCart(input);

      expect(result.isApplicable).toBe(false);
      expect(result.discount.totalDiscount).toBe(0);
      expect(result.discount.finalAmount).toBe(1000);
    });

    it('should surface maxDiscountValue as the cap to DiscountEngine', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue({
        ...cartPromo,
        maxDiscountValue: 50,
      });
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      discountEngine.compute.mockReturnValue({
        ...defaultDiscount,
        totalDiscount: 50,
        finalAmount: 950,
        wasCapped: true,
      });

      const result = await service.checkCouponOnCart(input);

      expect(discountEngine.compute).toHaveBeenCalledWith(
        1000,
        'INR',
        expect.any(Array),
        { amount: 50, percentage: 0 },
      );
      expect(result.discount.wasCapped).toBe(true);
    });

    it('should not pass a cap when maxDiscountValue is unset', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue({
        ...cartPromo,
        maxDiscountValue: null,
      });
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      discountEngine.compute.mockReturnValue(defaultDiscount as any);

      await service.checkCouponOnCart(input);

      expect(discountEngine.compute).toHaveBeenCalledWith(
        1000,
        'INR',
        expect.any(Array),
        undefined,
      );
    });

    // ─── Response mapping ────────────────────────────────────────

    it('should map coupon type using the response mapper', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue({
        ...cartPromo,
        rewardType: 'PERCENT',
      });
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      discountEngine.compute.mockReturnValue(defaultDiscount as any);
      responseMapper.mapCouponType.mockReturnValue('percentage');

      const result = await service.checkCouponOnCart(input);

      expect(responseMapper.mapCouponType).toHaveBeenCalledWith('PERCENT');
      expect(result.coupon_type).toBe('percentage');
    });

    it('should derive the coupon code from the promo when not supplied in input', async () => {
      prisma.rewardProgram.findUnique.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      discountEngine.compute.mockReturnValue(defaultDiscount as any);

      const result = await service.checkCouponOnCart({
        ...input,
        couponCode: undefined,
        couponId: 'promo-cart',
      });

      expect(result.coupon_code).toBe('SAVE100');
    });

    it('should serialize promo endDate as ISO string in expires_at', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      discountEngine.compute.mockReturnValue(defaultDiscount as any);

      const result = await service.checkCouponOnCart(input);

      expect(result.expires_at).toBe('2025-12-31T00:00:00.000Z');
    });

    it('should surface promo attributes in the response', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue({
        ...cartPromo,
        attributes: { offer_tag: 'FESTIVE', priority_channel: 'APP' },
      });
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      discountEngine.compute.mockReturnValue(defaultDiscount as any);

      const result = await service.checkCouponOnCart(input);

      expect(result.attributes).toEqual({
        offer_tag: 'FESTIVE',
        priority_channel: 'APP',
      });
    });

    it('should return an empty attributes object when promo has none', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue({
        ...cartPromo,
        attributes: null,
      });
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      discountEngine.compute.mockReturnValue(defaultDiscount as any);

      const result = await service.checkCouponOnCart(input);

      expect(result.attributes).toEqual({});
    });

    it('should use the input currency when computing discounts', async () => {
      prisma.rewardProgram.findFirst.mockResolvedValue(cartPromo);
      prisma.couponCode.findUnique.mockResolvedValue(availableCodeRecord);
      discountEngine.compute.mockReturnValue(defaultDiscount as any);

      await service.checkCouponOnCart({
        ...input,
        currency: 'USD',
      });

      expect(discountEngine.compute).toHaveBeenCalledWith(
        1000,
        'USD',
        expect.any(Array),
        expect.any(Object),
      );
    });
  });
});
