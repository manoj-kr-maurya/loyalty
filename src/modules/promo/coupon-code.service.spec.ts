import { BadRequestException } from '@nestjs/common';
import { CouponCodeService } from './coupon-code.service';

describe('CouponCodeService', () => {
  let service: CouponCodeService;

  const prisma = {
    couponCode: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const activeProgram = {
    id: 'program-1',
    status: 'ACTIVE',
    endDate: new Date('2026-12-31T23:59:59.000Z'),
    minimumCartValue: null,
    businessType: [],
  };

  const couponCode = (overrides: Record<string, unknown> = {}) => ({
    id: 'code-1',
    code: 'SAVE10',
    programId: 'program-1',
    customerId: null,
    isUserSpecific: false,
    status: 'AVAILABLE',
    usedCount: 0,
    maxUses: 1,
    allocatedAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: null,
    program: activeProgram,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    service = new CouponCodeService(prisma as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('validateCode', () => {
    it('treats a null maxUses as unlimited', async () => {
      prisma.couponCode.findUnique.mockResolvedValue(
        couponCode({ maxUses: null, usedCount: 100 }),
      );

      const result = await service.validateCode({
        code: 'SAVE10',
        customerId: 'customer-1',
      });

      expect(result.isValid).toBe(true);
    });

    it('rejects a limited code that reached maxUses', async () => {
      prisma.couponCode.findUnique.mockResolvedValue(
        couponCode({ maxUses: 2, usedCount: 2 }),
      );

      const result = await service.validateCode({
        code: 'SAVE10',
        customerId: 'customer-1',
      });

      expect(result).toEqual({
        isValid: false,
        message: 'This coupon code has reached its usage limit',
      });
    });
  });

  describe('claimCode', () => {
    it('increments usage for an unlimited code without marking it claimed', async () => {
      prisma.couponCode.findUnique.mockResolvedValue(
        couponCode({ maxUses: null, usedCount: 100 }),
      );
      prisma.couponCode.update.mockResolvedValue(
        couponCode({ maxUses: null, usedCount: 101 }),
      );

      await service.claimCode('SAVE10', 'customer-1', 'txn-1');

      expect(prisma.couponCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: {
          usedCount: { increment: 1 },
          status: 'AVAILABLE',
        },
      });
    });

    it('marks the code claimed when the final use is consumed', async () => {
      prisma.couponCode.findUnique.mockResolvedValue(
        couponCode({ maxUses: 2, usedCount: 1 }),
      );
      prisma.couponCode.update.mockResolvedValue(
        couponCode({ maxUses: 2, usedCount: 2, status: 'CLAIMED' }),
      );

      await service.claimCode('SAVE10', 'customer-1');

      expect(prisma.couponCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: {
          usedCount: { increment: 1 },
          status: 'CLAIMED',
        },
      });
    });

    it('rejects a limited code that reached maxUses', async () => {
      prisma.couponCode.findUnique.mockResolvedValue(
        couponCode({ maxUses: 1, usedCount: 1 }),
      );

      await expect(
        service.claimCode('SAVE10', 'customer-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
