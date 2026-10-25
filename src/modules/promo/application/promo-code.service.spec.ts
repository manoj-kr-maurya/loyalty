import { CommonException } from 'src/common/exceptions/common.exception';
import {
  CreatePromoCodeInput,
  PromoCodeService,
  ValidatePromoCodeInput,
} from './promo-code.service';

describe('PromoCodeService', () => {
  let service: PromoCodeService;

  const repository = {
    findUnique: jest.fn(),
    create: jest.fn(),
    incrementUsedCount: jest.fn(),
    countRedemptions: jest.fn(),
    createRedemption: jest.fn(),
    findCodesForStacking: jest.fn(),
    findRedemptions: jest.fn(),
    runSerializable: jest.fn(),
  };

  const activePromoCode = {
    id: 'promo-1',
    organizationId: 'org-1',
    code: 'SAVE10',
    name: 'Save 10',
    description: null,
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minOrderAmount: null,
    maxDiscount: null,
    usageLimit: 100,
    perUserLimit: 1,
    usedCount: 0,
    isActive: true,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T23:59:59.000Z'),
    isStackable: false,
    applicableProducts: [],
  };

  const createInput = (
    overrides: Partial<CreatePromoCodeInput> = {},
  ): CreatePromoCodeInput => ({
    organizationId: 'org-1',
    code: 'SAVE10',
    name: 'Save 10',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T23:59:59.000Z'),
    ...overrides,
  });

  const validateInput = (
    overrides: Partial<ValidatePromoCodeInput> = {},
  ): ValidatePromoCodeInput => ({
    code: 'SAVE10',
    organizationId: 'org-1',
    customerId: 'cust-1',
    orderAmount: 1000,
    ...overrides,
  });

  const expectRejection = async (
    promise: Promise<unknown>,
    status: number,
    message?: string,
  ) => {
    const error = await promise.then(
      () => null,
      (rejection: unknown) => rejection,
    );

    expect(error).toBeInstanceOf(CommonException);
    expect((error as CommonException).getStatus()).toBe(status);
    if (message) {
      expect((error as CommonException).getResponse()).toEqual(
        expect.objectContaining({
          error: expect.stringContaining(message),
        }),
      );
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    repository.runSerializable.mockImplementation(
      (callback: (tx: unknown) => unknown) => callback(repository),
    );
    service = new PromoCodeService(repository as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createPromoCode', () => {
    it('creates a promo code and returns the public shape', async () => {
      repository.findUnique.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        ...activePromoCode,
        discountValue: '10',
      });

      const result = await service.createPromoCode(createInput());

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          code: 'SAVE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          applicableProducts: [],
        }),
      );
      expect(result).toEqual({
        id: 'promo-1',
        code: 'SAVE10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        startDate: activePromoCode.startDate,
        endDate: activePromoCode.endDate,
      });
    });

    it('rejects a duplicate code', async () => {
      repository.findUnique.mockResolvedValue(activePromoCode);

      await expectRejection(
        service.createPromoCode(createInput()),
        409,
        'already exists',
      );
    });

    it('rejects invalid dates', async () => {
      repository.findUnique.mockResolvedValue(null);

      await expectRejection(
        service.createPromoCode(
          createInput({
            startDate: new Date('2026-12-31T00:00:00.000Z'),
            endDate: new Date('2026-01-01T00:00:00.000Z'),
          }),
        ),
        400,
        'startDate must be before endDate',
      );
    });

    it('rejects invalid discount values and types', async () => {
      repository.findUnique.mockResolvedValue(null);

      await expectRejection(
        service.createPromoCode(createInput({ discountValue: 0 })),
        400,
        'discountValue must be greater than zero',
      );
      await expectRejection(
        service.createPromoCode(createInput({ discountValue: 101 })),
        400,
        'Percentage discount',
      );
      await expectRejection(
        service.createPromoCode(
          createInput({ discountType: 'UNKNOWN' as never }),
        ),
        400,
        'Unsupported discountType',
      );
    });

    it('rejects negative optional limits', async () => {
      repository.findUnique.mockResolvedValue(null);

      await expectRejection(
        service.createPromoCode(createInput({ usageLimit: -1 })),
        400,
        'usageLimit must be a non-negative number',
      );
    });
  });

  describe('validatePromoCode', () => {
    it('returns invalid when the code does not exist', async () => {
      repository.findUnique.mockResolvedValue(null);

      await expect(service.validatePromoCode(validateInput())).resolves.toEqual(
        {
          code: 'SAVE10',
          valid: false,
          discountType: '',
          discountValue: 0,
          calculatedDiscount: 0,
          finalAmount: 1000,
          reason: 'Promo code not found',
        },
      );
    });

    it('returns invalid for a different organization', async () => {
      repository.findUnique.mockResolvedValue(activePromoCode);

      const result = await service.validatePromoCode(
        validateInput({ organizationId: 'org-2' }),
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Promo code not valid for this organization');
    });

    it('returns invalid for inactive and out-of-date codes', async () => {
      repository.findUnique.mockResolvedValueOnce({
        ...activePromoCode,
        isActive: false,
      });
      await expect(
        service.validatePromoCode(validateInput()),
      ).resolves.toMatchObject({
        valid: false,
        reason: 'Promo code is inactive',
      });

      jest.setSystemTime(new Date('2027-01-01T00:00:00.000Z'));
      repository.findUnique.mockResolvedValueOnce(activePromoCode);
      await expect(
        service.validatePromoCode(validateInput()),
      ).resolves.toMatchObject({
        valid: false,
        reason: 'Promo code is not valid at this time',
      });
    });

    it('enforces usage, per-user, minimum-order and product limits', async () => {
      repository.findUnique.mockResolvedValueOnce({
        ...activePromoCode,
        usageLimit: 5,
        usedCount: 5,
      });
      await expect(
        service.validatePromoCode(validateInput()),
      ).resolves.toMatchObject({
        valid: false,
        reason: 'Promo code usage limit reached',
      });

      repository.findUnique.mockResolvedValueOnce(activePromoCode);
      repository.countRedemptions.mockResolvedValueOnce(1);
      await expect(
        service.validatePromoCode(validateInput()),
      ).resolves.toMatchObject({
        valid: false,
        reason: 'You have already used this promo code',
      });

      repository.findUnique.mockResolvedValueOnce({
        ...activePromoCode,
        minOrderAmount: 500,
      });
      repository.countRedemptions.mockResolvedValueOnce(0);
      await expect(
        service.validatePromoCode(validateInput({ orderAmount: 400 })),
      ).resolves.toMatchObject({
        valid: false,
        reason: 'Minimum order amount of 500 required',
      });

      repository.findUnique.mockResolvedValueOnce({
        ...activePromoCode,
        applicableProducts: ['product-1'],
      });
      repository.countRedemptions.mockResolvedValueOnce(0);
      await expect(
        service.validatePromoCode(validateInput({ productIds: ['product-2'] })),
      ).resolves.toMatchObject({
        valid: false,
        reason: 'Promo code not applicable to these products',
      });
    });

    it('calculates percentage discounts with a maximum cap', async () => {
      repository.findUnique.mockResolvedValue({
        ...activePromoCode,
        discountValue: 50,
        maxDiscount: 100,
      });
      repository.countRedemptions.mockResolvedValue(0);

      await expect(
        service.validatePromoCode(validateInput({ orderAmount: 1000 })),
      ).resolves.toEqual({
        code: 'SAVE10',
        valid: true,
        discountType: 'PERCENTAGE',
        discountValue: 50,
        calculatedDiscount: 100,
        finalAmount: 900,
      });
    });

    it('calculates absolute, BOGO and free-shipping discounts', async () => {
      const cases = [
        { discountType: 'ABSOLUTE', discountValue: 75, expected: 75 },
        { discountType: 'BOGO', discountValue: 0, expected: 100 },
        { discountType: 'FREE_SHIPPING', discountValue: 0, expected: 0 },
      ];

      for (const testCase of cases) {
        repository.findUnique.mockResolvedValueOnce({
          ...activePromoCode,
          discountType: testCase.discountType,
          discountValue: testCase.discountValue,
        });
        repository.countRedemptions.mockResolvedValueOnce(0);

        const result = await service.validatePromoCode(
          validateInput({ orderAmount: 200 }),
        );

        expect(result.calculatedDiscount).toBe(testCase.expected);
        expect(result.finalAmount).toBe(200 - testCase.expected);
      }
    });

    it('rounds discounts to two decimal places', async () => {
      repository.findUnique.mockResolvedValue({
        ...activePromoCode,
        discountValue: 10,
      });
      repository.countRedemptions.mockResolvedValue(0);

      const result = await service.validatePromoCode(
        validateInput({ orderAmount: 99.99 }),
      );

      expect(result.calculatedDiscount).toBe(10);
      expect(result.finalAmount).toBe(89.99);
    });

    it('rejects non-positive order amounts', async () => {
      await expectRejection(
        service.validatePromoCode(validateInput({ orderAmount: 0 })),
        400,
        'orderAmount must be greater than zero',
      );
    });
  });

  describe('redeemPromoCode', () => {
    it('redeems atomically and increments usage', async () => {
      repository.findUnique.mockResolvedValue(activePromoCode);
      repository.countRedemptions.mockResolvedValue(0);
      repository.createRedemption.mockResolvedValue({ id: 'redemption-1' });
      repository.incrementUsedCount.mockResolvedValue({});

      const result = await service.redeemPromoCode({
        code: 'SAVE10',
        organizationId: 'org-1',
        customerId: 'cust-1',
        orderAmount: 1000,
        orderRef: 'order-1',
      });

      expect(result).toEqual({
        success: true,
        code: 'SAVE10',
        discountAmount: 100,
        finalAmount: 900,
        redemptionId: 'redemption-1',
      });
      expect(repository.createRedemption).toHaveBeenCalledWith({
        promoCodeId: 'promo-1',
        customerId: 'cust-1',
        organizationId: 'org-1',
        orderRef: 'order-1',
        discountAmount: 100,
        orderAmount: 1000,
      });
      expect(repository.incrementUsedCount).toHaveBeenCalledWith('promo-1');
    });

    it('rejects missing, inactive or foreign codes', async () => {
      repository.findUnique.mockResolvedValueOnce(null);
      await expectRejection(
        service.redeemPromoCode({
          code: 'MISSING',
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 100,
        }),
        404,
        'Promo code not found',
      );

      repository.findUnique.mockResolvedValueOnce({
        ...activePromoCode,
        isActive: false,
      });
      await expectRejection(
        service.redeemPromoCode({
          code: 'SAVE10',
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 100,
        }),
        400,
        'not valid for this organization or time',
      );

      repository.findUnique.mockResolvedValueOnce(activePromoCode);
      await expectRejection(
        service.redeemPromoCode({
          code: 'SAVE10',
          organizationId: 'org-2',
          customerId: 'cust-1',
          orderAmount: 100,
        }),
        400,
        'not valid for this organization or time',
      );
    });

    it('enforces usage, per-user and minimum-order limits', async () => {
      repository.findUnique.mockResolvedValueOnce({
        ...activePromoCode,
        usageLimit: 1,
        usedCount: 1,
      });
      await expectRejection(
        service.redeemPromoCode({
          code: 'SAVE10',
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 100,
        }),
        400,
        'usage limit reached',
      );

      repository.findUnique.mockResolvedValueOnce(activePromoCode);
      repository.countRedemptions.mockResolvedValueOnce(1);
      await expectRejection(
        service.redeemPromoCode({
          code: 'SAVE10',
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 100,
        }),
        400,
        'already used',
      );

      repository.findUnique.mockResolvedValueOnce({
        ...activePromoCode,
        minOrderAmount: 500,
      });
      await expectRejection(
        service.redeemPromoCode({
          code: 'SAVE10',
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 100,
        }),
        400,
        'Minimum order amount',
      );
    });

    it('retries serialization failures and then succeeds', async () => {
      repository.runSerializable
        .mockRejectedValueOnce({ code: 'P2034' })
        .mockImplementationOnce((callback: (tx: unknown) => unknown) =>
          callback(repository),
        );
      repository.findUnique.mockResolvedValue(activePromoCode);
      repository.countRedemptions.mockResolvedValue(0);
      repository.createRedemption.mockResolvedValue({ id: 'redemption-1' });
      repository.incrementUsedCount.mockResolvedValue({});

      const result = await service.redeemPromoCode({
        code: 'SAVE10',
        organizationId: 'org-1',
        customerId: 'cust-1',
        orderAmount: 100,
      });

      expect(result.redemptionId).toBe('redemption-1');
      expect(repository.runSerializable).toHaveBeenCalledTimes(2);
    });

    it('returns a conflict after three serialization failures', async () => {
      repository.runSerializable.mockRejectedValue({ code: 'P2034' });

      await expectRejection(
        service.redeemPromoCode({
          code: 'SAVE10',
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 100,
        }),
        409,
        'could not be completed',
      );
      expect(repository.runSerializable).toHaveBeenCalledTimes(3);
    });

    it('rethrows non-serialization errors immediately', async () => {
      repository.runSerializable.mockRejectedValue(new Error('database down'));

      await expect(
        service.redeemPromoCode({
          code: 'SAVE10',
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 100,
        }),
      ).rejects.toThrow('database down');
      expect(repository.runSerializable).toHaveBeenCalledTimes(1);
    });

    it('rejects non-positive order amounts', async () => {
      await expectRejection(
        service.redeemPromoCode({
          code: 'SAVE10',
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 0,
        }),
        400,
        'orderAmount must be greater than zero',
      );
    });
  });

  describe('evaluateStacking', () => {
    it('returns an empty successful result for no codes', async () => {
      await expect(
        service.evaluateStacking({
          codes: [],
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 100,
        }),
      ).resolves.toEqual({
        applicable: true,
        codes: [],
        totalDiscount: 0,
        finalAmount: 100,
        breakdown: [],
      });
    });

    it('rejects duplicate codes', async () => {
      await expect(
        service.evaluateStacking({
          codes: ['SAVE10', 'SAVE10'],
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 100,
        }),
      ).resolves.toEqual({
        applicable: false,
        codes: ['SAVE10', 'SAVE10'],
        totalDiscount: 0,
        finalAmount: 100,
        breakdown: [],
      });
    });

    it('rejects non-positive order amounts', async () => {
      await expectRejection(
        service.evaluateStacking({
          codes: ['SAVE10'],
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 0,
        }),
        400,
        'orderAmount must be greater than zero',
      );
    });

    it('marks a missing or invalid code as not applicable', async () => {
      repository.findCodesForStacking.mockResolvedValue([
        {
          ...activePromoCode,
          isStackable: true,
          redemptions: [],
        },
      ]);

      await expect(
        service.evaluateStacking({
          codes: ['SAVE10', 'MISSING'],
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 1000,
        }),
      ).resolves.toMatchObject({
        applicable: false,
        totalDiscount: 0,
      });
    });

    it('rejects multiple codes when any code is not stackable', async () => {
      repository.findCodesForStacking.mockResolvedValue([
        { ...activePromoCode, code: 'A', isStackable: true, redemptions: [] },
        { ...activePromoCode, code: 'B', isStackable: false, redemptions: [] },
      ]);

      await expect(
        service.evaluateStacking({
          codes: ['A', 'B'],
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 1000,
        }),
      ).resolves.toMatchObject({
        applicable: false,
        totalDiscount: 0,
      });
    });

    it('applies stackable discounts sequentially', async () => {
      repository.findCodesForStacking.mockResolvedValue([
        {
          ...activePromoCode,
          code: 'A',
          discountValue: 10,
          isStackable: true,
          redemptions: [],
        },
        {
          ...activePromoCode,
          code: 'B',
          discountValue: 20,
          isStackable: true,
          redemptions: [],
        },
      ]);

      await expect(
        service.evaluateStacking({
          codes: ['A', 'B'],
          organizationId: 'org-1',
          customerId: 'cust-1',
          orderAmount: 1000,
        }),
      ).resolves.toEqual({
        applicable: true,
        codes: ['A', 'B'],
        totalDiscount: 280,
        finalAmount: 720,
        breakdown: [
          { code: 'A', discountType: 'PERCENTAGE', discountAmount: 100 },
          { code: 'B', discountType: 'PERCENTAGE', discountAmount: 180 },
        ],
      });
    });
  });

  describe('getRedemptionHistory', () => {
    it('returns mapped redemptions and the total saved amount', async () => {
      const redeemedAt = new Date('2026-06-01T10:00:00.000Z');
      repository.findRedemptions.mockResolvedValue([
        {
          code: 'SAVE10',
          discountAmount: '100',
          orderAmount: '1000',
          redeemedAt,
          promoCode: { code: 'SAVE10' },
        },
        {
          code: 'SAVE20',
          discountAmount: 50,
          orderAmount: 500,
          redeemedAt,
          promoCode: { code: 'SAVE20' },
        },
      ]);

      await expect(
        service.getRedemptionHistory('cust-1', 'org-1'),
      ).resolves.toEqual({
        customerId: 'cust-1',
        organizationId: 'org-1',
        totalSaved: 150,
        redemptions: [
          {
            code: 'SAVE10',
            discountAmount: 100,
            orderAmount: 1000,
            redeemedAt,
          },
          {
            code: 'SAVE20',
            discountAmount: 50,
            orderAmount: 500,
            redeemedAt,
          },
        ],
      });
      expect(repository.findRedemptions).toHaveBeenCalledWith(
        'cust-1',
        'org-1',
      );
    });
  });
});
