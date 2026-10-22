import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prismaService';

export interface GenerateCodeInput {
  programId: string;
  customerId?: string;
  isUserSpecific: boolean;
  count?: number;
  codeLength?: number;
  maxUses?: number;
  expiresAt?: string;
}

export interface ValidateCodeInput {
  code: string;
  customerId?: string;
  cartValue?: number;
  isBankOffer?: boolean;
}

export interface CouponCodeResult {
  id: string;
  code: string;
  programId: string;
  customerId: string | null;
  isUserSpecific: boolean;
  status: string;
  usedCount: number;
  maxUses: number;
  allocatedAt: Date;
  expiresAt: Date | null;
}

@Injectable()
export class CouponCodeService {
  private readonly logger = new Logger(CouponCodeService.name);
  private readonly CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  constructor(private readonly prisma: PrismaService) {}

  private generateRandomCode(length: number): string {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += this.CHARS.charAt(Math.floor(Math.random() * this.CHARS.length));
    }
    return code;
  }

  private async generateUniqueCode(length: number, maxAttempts = 10): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      const code = this.generateRandomCode(length);
      const exists = await this.prisma.couponCode.findUnique({ where: { code } });
      if (!exists) return code;
    }
    throw new BadRequestException('Unable to generate unique code, please try again');
  }

  async generateCodes(input: GenerateCodeInput): Promise<CouponCodeResult[]> {
    const program = await this.prisma.rewardProgram.findUnique({ where: { id: input.programId } });
    if (!program) throw new NotFoundException('Reward program not found');

    const count = input.count ?? 1;
    const codeLength = input.codeLength ?? 6;
    const maxUses = input.maxUses ?? 1;

    if (count > 100) throw new BadRequestException('Cannot generate more than 100 codes at once');

    const results: CouponCodeResult[] = [];

    for (let i = 0; i < count; i++) {
      const code = await this.generateUniqueCode(codeLength);
      const couponCode = await this.prisma.couponCode.create({
        data: {
          code,
          programId: input.programId,
          customerId: input.isUserSpecific ? (input.customerId ?? null) : null,
          isUserSpecific: input.isUserSpecific,
          maxUses,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });
      results.push(couponCode as CouponCodeResult);
    }

    this.logger.log(`Generated ${count} coupon codes for program ${input.programId}`);
    return results;
  }

  async validateCode(input: ValidateCodeInput): Promise<{
    isValid: boolean;
    message: string;
    couponCode?: CouponCodeResult;
    promotion?: any;
  }> {
    const couponCode = await this.prisma.couponCode.findUnique({
      where: { code: input.code },
      include: { program: { include: { rules: true } } },
    });

    if (!couponCode) {
      return { isValid: false, message: 'Invalid coupon code' };
    }

    if (couponCode.status === 'EXPIRED' || couponCode.status === 'REVOKED') {
      return { isValid: false, message: 'This coupon code is no longer active' };
    }

    if (couponCode.expiresAt && new Date(couponCode.expiresAt) < new Date()) {
      await this.prisma.couponCode.update({ where: { id: couponCode.id }, data: { status: 'EXPIRED' } });
      return { isValid: false, message: 'This coupon code has expired' };
    }

    if (couponCode.usedCount >= couponCode.maxUses) {
      return { isValid: false, message: 'This coupon code has reached its usage limit' };
    }

    if (couponCode.isUserSpecific && couponCode.customerId) {
      if (!input.customerId) {
        return { isValid: false, message: 'Customer ID is required for this coupon' };
      }
      if (couponCode.customerId !== input.customerId) {
        return { isValid: false, message: 'This coupon code is not assigned to you' };
      }
    }

    const promo = couponCode.program;
    if (promo.status !== 'ACTIVE') {
      return { isValid: false, message: 'This promotion is no longer active' };
    }
    if (promo.endDate && new Date(promo.endDate) < new Date()) {
      return { isValid: false, message: 'This promotion has expired' };
    }

    if (promo.minimumCartValue && input.cartValue !== undefined) {
      if (input.cartValue < Number(promo.minimumCartValue)) {
        return { isValid: false, message: `Minimum cart value of ₹${promo.minimumCartValue} required` };
      }
    }

    const businessTypes = (promo.businessType as string[]) ?? [];
    const isBankType = businessTypes.some((t) => t.toLowerCase().includes('bank'));
    if (isBankType && !input.isBankOffer) {
      return { isValid: false, message: 'This is a bank-specific offer' };
    }

    return {
      isValid: true,
      message: 'Coupon code is valid',
      couponCode: couponCode as CouponCodeResult,
      promotion: promo,
    };
  }

  async allocateCode(programId: string, customerId: string): Promise<CouponCodeResult> {
    const availableCode = await this.prisma.couponCode.findFirst({
      where: {
        programId,
        isUserSpecific: true,
        status: 'AVAILABLE',
        customerId: null,
      },
    });

    if (!availableCode) {
      throw new BadRequestException('No available coupon codes to allocate');
    }

    const updated = await this.prisma.couponCode.update({
      where: { id: availableCode.id },
      data: { customerId },
    });

    return updated as CouponCodeResult;
  }

  async claimCode(code: string, customerId: string, transactionRef?: string): Promise<CouponCodeResult> {
    const couponCode = await this.prisma.couponCode.findUnique({ where: { code } });
    if (!couponCode) throw new NotFoundException('Coupon code not found');

    if (couponCode.isUserSpecific && couponCode.customerId !== customerId) {
      throw new BadRequestException('This coupon code is not assigned to you');
    }

    if (couponCode.usedCount >= couponCode.maxUses) {
      throw new BadRequestException('Coupon code usage limit reached');
    }

    const updated = await this.prisma.couponCode.update({
      where: { id: couponCode.id },
      data: {
        usedCount: { increment: 1 },
        status: couponCode.usedCount + 1 >= couponCode.maxUses ? 'CLAIMED' : 'AVAILABLE',
      },
    });

    return updated as CouponCodeResult;
  }

  async listCodes(programId: string, customerId?: string): Promise<CouponCodeResult[]> {
    const where: any = { programId };
    if (customerId) where.customerId = customerId;

    return this.prisma.couponCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    }) as any;
  }

  async getCodeByCustomer(programId: string, customerId: string): Promise<CouponCodeResult | null> {
    return this.prisma.couponCode.findFirst({
      where: { programId, customerId },
    }) as any;
  }
}
