import { PromoEngineController } from './promo-engine.controller';
import { PromoCodeService } from '../application/promo-code.service';

describe('PromoEngineController', () => {
  let controller: PromoEngineController;
  let service: jest.Mocked<PromoCodeService>;

  beforeEach(() => {
    service = {
      createPromoCode: jest.fn(),
      validatePromoCode: jest.fn(),
      redeemPromoCode: jest.fn(),
      evaluateStacking: jest.fn(),
      getRedemptionHistory: jest.fn(),
    } as unknown as jest.Mocked<PromoCodeService>;

    controller = new PromoEngineController(service);
  });

  it('POST /engines/promo/codes converts dates and delegates', async () => {
    const response = {
      id: 'promo-1',
      code: 'SAVE10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
    };
    service.createPromoCode.mockResolvedValue(response);

    const body = {
      organizationId: 'org-1',
      code: 'SAVE10',
      discountType: 'PERCENTAGE' as const,
      discountValue: 10,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
    };

    await expect(controller.createPromoCode(body)).resolves.toEqual(response);
    expect(service.createPromoCode).toHaveBeenCalledWith({
      ...body,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
    });
  });

  it('POST /engines/promo/validate delegates the validation payload', async () => {
    const body = {
      code: 'SAVE10',
      organizationId: 'org-1',
      customerId: 'cust-1',
      orderAmount: 1000,
      productIds: ['product-1'],
    };
    const response = {
      valid: true,
      code: 'SAVE10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      calculatedDiscount: 100,
      finalAmount: 900,
    };
    service.validatePromoCode.mockResolvedValue(response);

    await expect(controller.validatePromoCode(body)).resolves.toEqual(response);
    expect(service.validatePromoCode).toHaveBeenCalledWith(body);
  });

  it('POST /engines/promo/redeem delegates the redemption payload', async () => {
    const body = {
      code: 'SAVE10',
      organizationId: 'org-1',
      customerId: 'cust-1',
      orderAmount: 1000,
      orderRef: 'order-1',
    };
    const response = {
      success: true,
      code: 'SAVE10',
      discountAmount: 100,
      finalAmount: 900,
      redemptionId: 'redemption-1',
    };
    service.redeemPromoCode.mockResolvedValue(response);

    await expect(controller.redeemPromoCode(body)).resolves.toEqual(response);
    expect(service.redeemPromoCode).toHaveBeenCalledWith(body);
  });

  it('POST /engines/promo/stacking delegates the stacking payload', async () => {
    const body = {
      codes: ['SAVE10', 'SAVE20'],
      organizationId: 'org-1',
      customerId: 'cust-1',
      orderAmount: 1000,
    };
    const response = {
      applicable: true,
      codes: ['SAVE10', 'SAVE20'],
      totalDiscount: 280,
      finalAmount: 720,
      breakdown: [],
    };
    service.evaluateStacking.mockResolvedValue(response);

    await expect(controller.evaluateStacking(body)).resolves.toEqual(response);
    expect(service.evaluateStacking).toHaveBeenCalledWith(body);
  });

  it('GET /engines/promo/redemptions returns customer history', async () => {
    const response = {
      customerId: 'cust-1',
      organizationId: 'org-1',
      totalSaved: 150,
      redemptions: [],
    };
    service.getRedemptionHistory.mockResolvedValue(response);

    await expect(
      controller.getRedemptionHistory('cust-1', 'org-1'),
    ).resolves.toEqual(response);
    expect(service.getRedemptionHistory).toHaveBeenCalledWith(
      'cust-1',
      'org-1',
    );
  });
});
