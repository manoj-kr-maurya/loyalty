import { Test, TestingModule } from '@nestjs/testing';
import { PromoController } from './promo.controller';
import { PromoService, EvaluatePromotionsOutput } from './promo.service';
import { CouponCodeService } from './coupon-code.service';
import { CouponBlock } from './coupon-manager.service';
import { ClaimRecord } from './claim-manager.service';
import { PromotionRecord } from './promotion-repository.service';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';

describe('PromoController', () => {
  let controller: PromoController;
  let promoService: jest.Mocked<PromoService>;

  const mockPromotion: PromotionRecord = {
    id: 'promo-1',
    organizationId: 'org-1',
    name: 'Summer Sale',
    description: '10% off',
    programType: 'PROMO',
    rewardType: 'DISCOUNT',
    status: 'ACTIVE',
    rewardCurrency: 'INR',
    budgetEnabled: true,
    priority: 10,
    business: null,
    category: null,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-12-31'),
    timezone: 'UTC',
    blackoutDates: null,
    workingDays: null,
    dailyTimeSlots: null,
    version: 1,
    rules: [],
  };

  const mockCoupon: CouponBlock = {
    blockId: 'CPN-1',
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
    transactionRef: 'txn-1',
    status: 'CONFIRMED',
    details: {},
    claimedAt: new Date(),
  };

  const mockEvaluateOutput: EvaluatePromotionsOutput = {
    success: true,
    transactionRef: 'txn-123',
    eligiblePromotions: 1,
    conflictResolution: { winners: [mockPromotion], excluded: [], resolvedAwards: [] },
    discount: {
      discounts: [],
      totalDiscount: 50,
      finalAmount: 450,
      wasCapped: false,
    },
    budgetReservations: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromoController],
      providers: [
        {
          provide: PromoService,
          useFactory: () => ({
          createAndPersistPromotion: jest.fn().mockResolvedValue({ id: 'promo-new', name: 'New Promo' }),
            updatePromotion: jest.fn().mockResolvedValue({ id: 'promo-1', name: 'Updated' }),
            upsertRules: jest.fn().mockResolvedValue([]),
            createPromotion: jest.fn().mockResolvedValue({ success: true, promotion: {} }),
            evaluatePromotions: jest.fn().mockResolvedValue(mockEvaluateOutput),
            getActivePromotions: jest.fn().mockResolvedValue({ available_coupon_list: [mockPromotion], page: { current: 1, total: 1, has_previous: false, has_next: false, total_item_count: 1 } }),
            getPromotionById: jest.fn().mockResolvedValue(mockPromotion),
            allocateCoupon: jest.fn().mockResolvedValue(mockCoupon),
            blockCoupon: jest.fn().mockResolvedValue(mockCoupon),
            releaseCoupon: jest.fn().mockResolvedValue({ ...mockCoupon, status: 'RELEASED' }),
            claimCoupon: jest.fn().mockResolvedValue({ ...mockCoupon, status: 'CLAIMED' }),
            getCustomerCoupons: jest.fn().mockResolvedValue([mockCoupon]),
            getCoupon: jest.fn().mockResolvedValue(mockCoupon),
            recordClaim: jest.fn().mockResolvedValue(mockClaim),
            revokeClaim: jest.fn().mockResolvedValue({ ...mockClaim, status: 'REVOKED' }),
            getClaimById: jest.fn().mockResolvedValue(mockClaim),
            getCustomerClaimSummary: jest.fn().mockResolvedValue({
              totalClaimed: 500,
              totalReversed: 50,
              claimCount: 5,
            }),
          }),
        },
        {
          provide: ConfigService,
          useFactory: () => ({
            get: jest.fn().mockReturnValue('gyhewd8x34y87ddsyn9738t94587rfybds09t478fts7ndyr7yfd0gyn7t'),
          }),
        },
        {
          provide: CouponCodeService,
          useFactory: () => ({
            generateCodes: jest.fn().mockResolvedValue([
              { id: 'cc-1', code: 'TESTCODE', isUserSpecific: true, status: 'AVAILABLE', maxUses: 1, usedCount: 0 },
            ]),
            validateCode: jest.fn().mockResolvedValue({ isValid: true, message: 'Valid' }),
            allocateCode: jest.fn().mockResolvedValue({ id: 'cc-1', code: 'TESTCODE', customerId: 'cust-1' }),
            claimCode: jest.fn().mockResolvedValue({ id: 'cc-1', code: 'TESTCODE', status: 'CLAIMED' }),
            listCodes: jest.fn().mockResolvedValue([]),
            getCodeByCustomer: jest.fn().mockResolvedValue(null),
          }),
        },
        {
          provide: ApiKeyGuard,
          useFactory: () => ({
            canActivate: jest.fn().mockReturnValue(true),
          }),
        },
      ],
    }).compile();

    controller = module.get<PromoController>(PromoController);
    promoService = module.get(PromoService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPromotion', () => {
    it('should call service and return success', async () => {
      const form = {
        organizationId: 'org-1',
        name: 'New Promo',
        programId: 'prog-1',
        amount: 100,
        currency: 'INR',
        reference: 'ref-1',
      };

      const result = await controller.createPromotion(form as any);

      expect(result).toHaveProperty('id');
      expect(promoService.createAndPersistPromotion).toHaveBeenCalledWith('org-1', {
        name: 'New Promo',
        programId: 'prog-1',
        amount: 100,
        currency: 'INR',
        reference: 'ref-1',
      });
    });
  });

  describe('evaluatePromotions', () => {
    it('should evaluate promotions and return discount result', async () => {
      const input = {
        organizationId: 'org-1',
        customerId: 'cust-1',
        transactionAmount: 500,
        currency: 'INR',
        transactionRef: 'txn-123',
      };

      const result = await controller.evaluatePromotions(input);

      expect(result.success).toBe(true);
      expect(result.eligiblePromotions).toBeGreaterThanOrEqual(0);
      expect(result.discount).toBeDefined();
      expect(result.discount.finalAmount).toBe(450);
      expect(promoService.evaluatePromotions).toHaveBeenCalledWith(input);
    });
  });

  describe('getActivePromotions', () => {
    it('should return active promotions for an organization', async () => {
      const result = await controller.getActivePromotions('org-1');

      expect(result).toHaveProperty('available_coupon_list');
      expect(result).toHaveProperty('page');
      expect(promoService.getActivePromotions).toHaveBeenCalledWith('org-1', expect.objectContaining({
        organizationId: 'org-1',
      }));
    });
  });

  describe('getPromotionById', () => {
    it('should return a promotion by ID', async () => {
      const result = await controller.getPromotionById('promo-1');

      expect(result).toEqual(mockPromotion);
      expect(promoService.getPromotionById).toHaveBeenCalledWith('promo-1');
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

      const result = await controller.allocateCoupon(allocation);

      expect(result.blockId).toBeDefined();
      expect(promoService.allocateCoupon).toHaveBeenCalledWith(allocation);
    });

    it('should block a coupon', async () => {
      const result = await controller.blockCoupon('CPN-1');

      expect(result).toEqual(mockCoupon);
      expect(promoService.blockCoupon).toHaveBeenCalledWith('CPN-1');
    });

    it('should release a coupon', async () => {
      const result = await controller.releaseCoupon('CPN-1', 'timeout');

      expect(result).toBeDefined();
      expect(promoService.releaseCoupon).toHaveBeenCalledWith('CPN-1', 'timeout');
    });

    it('should claim a coupon', async () => {
      const claim = {
        blockId: 'CPN-1',
        customerId: 'cust-1',
        couponCode: 'SAVE10',
        transactionRef: 'txn-1',
        claimedAmount: 100,
      };

      const result = await controller.claimCoupon(claim);

      expect(result).toBeDefined();
      expect(promoService.claimCoupon).toHaveBeenCalledWith(claim);
    });

    it('should get customer coupons', async () => {
      const result = await controller.getCustomerCoupons('cust-1');

      expect(result).toEqual([mockCoupon]);
      expect(promoService.getCustomerCoupons).toHaveBeenCalledWith('cust-1');
    });

    it('should get coupon by block ID', async () => {
      const result = await controller.getCoupon('CPN-1');

      expect(result).toEqual(mockCoupon);
      expect(promoService.getCoupon).toHaveBeenCalledWith('CPN-1');
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
        transactionRef: 'txn-1',
      };

      const result = await controller.recordClaim(input);

      expect(result.id).toBe('clm-1');
      expect(promoService.recordClaim).toHaveBeenCalledWith(input);
    });

    it('should revoke a claim', async () => {
      const result = await controller.revokeClaim('clm-1', 'refund', 'admin');

      expect(result).toBeDefined();
      expect(promoService.revokeClaim).toHaveBeenCalledWith('clm-1', 'refund', 'admin');
    });

    it('should get claim by ID', async () => {
      const result = await controller.getClaimById('clm-1');

      expect(result).toEqual(mockClaim);
      expect(promoService.getClaimById).toHaveBeenCalledWith('clm-1');
    });

    it('should get customer claim summary', async () => {
      const result = await controller.getCustomerClaimSummary('cust-1');

      expect(result).toEqual({ totalClaimed: 500, totalReversed: 50, claimCount: 5 });
      expect(promoService.getCustomerClaimSummary).toHaveBeenCalledWith('cust-1');
    });
  });
});
