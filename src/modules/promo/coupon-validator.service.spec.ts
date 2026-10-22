import { CouponValidatorService, CouponValidationInput } from './coupon-validator.service';

describe('CouponValidatorService - channel rule', () => {
  let service: CouponValidatorService;

  const baseInput: CouponValidationInput = {
    organizationId: 'org-1',
    cartValue: 1000,
  };

  const basePromo: any = {
    id: 'promo-1',
    status: 'ACTIVE',
    isArchived: false,
    startDate: new Date(Date.now() - 1000),
    endDate: new Date(Date.now() + 86400000),
  };

  beforeEach(() => {
    service = new CouponValidatorService({} as any);
  });

  it('applies to all channels when promo has no channel restriction', async () => {
    const result = await service.validate(basePromo, { ...baseInput, channel: 'app' });
    expect(result.isApplicable).toBe(true);
  });

  it('applies to all channels when promo channels include ALL', async () => {
    const result = await service.validate({ ...basePromo, channels: ['ALL'] }, { ...baseInput, channel: 'web' });
    expect(result.isApplicable).toBe(true);
  });

  it('applies when requested channel is in promo channels', async () => {
    const result = await service.validate({ ...basePromo, channels: ['APP', 'WEB'] }, { ...baseInput, channel: 'app' });
    expect(result.isApplicable).toBe(true);
  });

  it('rejects when requested channel is not in promo channels', async () => {
    const result = await service.validate({ ...basePromo, channels: ['APP'] }, { ...baseInput, channel: 'web' });
    expect(result.isApplicable).toBe(false);
    expect(result.couponApplicableMessage).toContain('not available');
  });

  it('applies when request has no channel (treat as all)', async () => {
    const result = await service.validate({ ...basePromo, channels: ['APP'] }, baseInput);
    expect(result.isApplicable).toBe(true);
  });
});
