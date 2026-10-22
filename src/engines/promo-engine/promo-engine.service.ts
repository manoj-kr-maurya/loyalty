import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

// ─── Input / Output Types ───────────────────────────────

export interface CreatePromoCodeInput {
  organizationId: string;
  code: string;
  name?: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'ABSOLUTE' | 'FREE_SHIPPING' | 'BOGO';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  startDate: Date;
  endDate: Date;
  isStackable?: boolean;
  applicableProducts?: string[];
}

export interface ValidatePromoCodeInput {
  code: string;
  organizationId: string;
  customerId: string;
  orderAmount: number;
  productIds?: string[];
}

export interface ValidatePromoCodeOutput {
  valid: boolean;
  code: string;
  discountType: string;
  discountValue: number;
  calculatedDiscount: number;
  finalAmount: number;
  reason?: string;
}

export interface RedeemPromoCodeInput {
  code: string;
  organizationId: string;
  customerId: string;
  orderAmount: number;
  orderRef?: string;
}

export interface RedeemPromoCodeOutput {
  success: boolean;
  code: string;
  discountAmount: number;
  finalAmount: number;
  redemptionId: string;
}

export interface StackingResult {
  applicable: boolean;
  codes: string[];
  totalDiscount: number;
  finalAmount: number;
  breakdown: Array<{
    code: string;
    discountType: string;
    discountAmount: number;
  }>;
}

@Injectable()
export class PromoEngineService {
  private readonly logger = new Logger(PromoEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Promo Code CRUD ──────────────────────────────────

  /**
   * Create a new promo code.
   */
  async createPromoCode(input: CreatePromoCodeInput): Promise<{
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    startDate: Date;
    endDate: Date;
  }> {
    const {
      organizationId,
      code,
      name,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      usageLimit,
      perUserLimit = 1,
      startDate,
      endDate,
      isStackable = false,
      applicableProducts,
    } = input;

    // Check for duplicate code
    const existing = await this.prisma.promoCode.findUnique({
      where: { code },
    });

    if (existing) {
      throw new CommonException(
        `Promo code "${code}" already exists`,
        StatusCodes.CONFLICT,
      );
    }

    // Validate dates
    if (startDate >= endDate) {
      throw new CommonException(
        'startDate must be before endDate',
        StatusCodes.BAD_REQUEST,
      );
    }

    // Validate discount
    if (discountType === 'PERCENTAGE' && (discountValue <= 0 || discountValue > 100)) {
      throw new CommonException(
        'Percentage discount must be between 0 and 100',
        StatusCodes.BAD_REQUEST,
      );
    }

    const promoCode = await this.prisma.promoCode.create({
      data: {
        organizationId,
        code,
        name,
        description,
        discountType,
        discountValue,
        minOrderAmount,
        maxDiscount,
        usageLimit,
        perUserLimit,
        startDate,
        endDate,
        isStackable,
        applicableProducts: applicableProducts || [],
      },
    });

    this.logger.log(`Promo code created: ${code} (${discountType} ${discountValue})`);

    return {
      id: promoCode.id,
      code: promoCode.code,
      discountType: promoCode.discountType,
      discountValue: Number(promoCode.discountValue),
      startDate: promoCode.startDate,
      endDate: promoCode.endDate,
    };
  }

  /**
   * Validate a promo code without redeeming it.
   */
  async validatePromoCode(input: ValidatePromoCodeInput): Promise<ValidatePromoCodeOutput> {
    const { code, organizationId, customerId, orderAmount, productIds } = input;

    const promoCode = await this.prisma.promoCode.findUnique({
      where: { code },
    });

    if (!promoCode) {
      return {
        code,
        valid: false,
        discountType: '',
        discountValue: 0,
        calculatedDiscount: 0,
        finalAmount: orderAmount,
        reason: 'Promo code not found',
      };
    }

    // Check organization
    if (promoCode.organizationId !== organizationId) {
      return {
        code,
        valid: false,
        discountType: promoCode.discountType,
        discountValue: Number(promoCode.discountValue),
        calculatedDiscount: 0,
        finalAmount: orderAmount,
        reason: 'Promo code not valid for this organization',
      };
    }

    // Check active
    if (!promoCode.isActive) {
      return {
        code,
        valid: false,
        discountType: promoCode.discountType,
        discountValue: Number(promoCode.discountValue),
        calculatedDiscount: 0,
        finalAmount: orderAmount,
        reason: 'Promo code is inactive',
      };
    }

    // Check date range
    const now = new Date();
    if (now < promoCode.startDate || now > promoCode.endDate) {
      return {
        code,
        valid: false,
        discountType: promoCode.discountType,
        discountValue: Number(promoCode.discountValue),
        calculatedDiscount: 0,
        finalAmount: orderAmount,
        reason: 'Promo code is not valid at this time',
      };
    }

    // Check usage limit
    if (promoCode.usageLimit && promoCode.usedCount >= promoCode.usageLimit) {
      return {
        code,
        valid: false,
        discountType: promoCode.discountType,
        discountValue: Number(promoCode.discountValue),
        calculatedDiscount: 0,
        finalAmount: orderAmount,
        reason: 'Promo code usage limit reached',
      };
    }

    // Check per-user limit
    const userRedemptions = await this.prisma.promoRedemption.count({
      where: { promoCodeId: promoCode.id, customerId },
    });

    if (promoCode.perUserLimit && userRedemptions >= promoCode.perUserLimit) {
      return {
        code,
        valid: false,
        discountType: promoCode.discountType,
        discountValue: Number(promoCode.discountValue),
        calculatedDiscount: 0,
        finalAmount: orderAmount,
        reason: 'You have already used this promo code',
      };
    }

    // Check min order amount
    if (promoCode.minOrderAmount && orderAmount < Number(promoCode.minOrderAmount)) {
      return {
        code,
        valid: false,
        discountType: promoCode.discountType,
        discountValue: Number(promoCode.discountValue),
        calculatedDiscount: 0,
        finalAmount: orderAmount,
        reason: `Minimum order amount of ${promoCode.minOrderAmount} required`,
      };
    }

    // Check product applicability
    if (promoCode.applicableProducts && productIds) {
      const applicableProducts = promoCode.applicableProducts as string[];
      if (applicableProducts.length > 0) {
        const hasApplicable = productIds.some((pid) => applicableProducts.includes(pid));
        if (!hasApplicable) {
          return {
            code,
            valid: false,
            discountType: promoCode.discountType,
            discountValue: Number(promoCode.discountValue),
            calculatedDiscount: 0,
            finalAmount: orderAmount,
            reason: 'Promo code not applicable to these products',
          };
        }
      }
    }

    // Calculate discount
    const calculatedDiscount = this.computeDiscount(
      orderAmount,
      promoCode.discountType,
      Number(promoCode.discountValue),
      promoCode.maxDiscount ? Number(promoCode.maxDiscount) : undefined,
    );

    return {
      code,
      valid: true,
      discountType: promoCode.discountType,
      discountValue: Number(promoCode.discountValue),
      calculatedDiscount,
      finalAmount: orderAmount - calculatedDiscount,
    };
  }

  /**
   * Redeem a promo code.
   */
  async redeemPromoCode(input: RedeemPromoCodeInput): Promise<RedeemPromoCodeOutput> {
    const { code, organizationId, customerId, orderAmount, orderRef } = input;

    // Validate first
    const validation = await this.validatePromoCode({
      code,
      organizationId,
      customerId,
      orderAmount,
    });

    if (!validation.valid) {
      throw new CommonException(validation.reason || 'Invalid promo code', StatusCodes.BAD_REQUEST);
    }

    const promoCode = await this.prisma.promoCode.findUnique({
      where: { code },
    });

    if (!promoCode) {
      throw new CommonException('Promo code not found', StatusCodes.NOT_FOUND);
    }

    // Record redemption
    const redemption = await this.prisma.promoRedemption.create({
      data: {
        promoCodeId: promoCode.id,
        customerId,
        organizationId,
        orderRef,
        discountAmount: validation.calculatedDiscount,
        orderAmount,
      },
    });

    // Increment usage count
    await this.prisma.promoCode.update({
      where: { id: promoCode.id },
      data: { usedCount: { increment: 1 } },
    });

    this.logger.log(
      `Promo redeemed: ${code} by ${customerId} discount=${validation.calculatedDiscount}`,
    );

    return {
      success: true,
      code,
      discountAmount: validation.calculatedDiscount,
      finalAmount: validation.finalAmount,
      redemptionId: redemption.id,
    };
  }

  /**
   * Evaluate stacking of multiple promo codes.
   */
  async evaluateStacking(input: {
    codes: string[];
    organizationId: string;
    customerId: string;
    orderAmount: number;
  }): Promise<StackingResult> {
    const { codes, organizationId, customerId, orderAmount } = input;

    if (codes.length === 0) {
      return {
        applicable: true,
        codes: [],
        totalDiscount: 0,
        finalAmount: orderAmount,
        breakdown: [],
      };
    }

    const promoCodes = await this.prisma.promoCode.findMany({
      where: {
        code: { in: codes },
        organizationId,
        isActive: true,
      },
    });

    // Check if all codes are stackable
    const nonStackable = promoCodes.filter((pc) => !pc.isStackable);
    if (nonStackable.length > 0 && codes.length > 1) {
      return {
        applicable: false,
        codes,
        totalDiscount: 0,
        finalAmount: orderAmount,
        breakdown: [],
      };
    }

    // Calculate discounts sequentially
    let remainingAmount = orderAmount;
    const breakdown: Array<{ code: string; discountType: string; discountAmount: number }> = [];

    for (const promoCode of promoCodes) {
      const discount = this.computeDiscount(
        remainingAmount,
        promoCode.discountType,
        Number(promoCode.discountValue),
        promoCode.maxDiscount ? Number(promoCode.maxDiscount) : undefined,
      );
      breakdown.push({
        code: promoCode.code,
        discountType: promoCode.discountType,
        discountAmount: discount,
      });
      remainingAmount -= discount;
    }

    const totalDiscount = orderAmount - remainingAmount;

    return {
      applicable: true,
      codes,
      totalDiscount,
      finalAmount: remainingAmount,
      breakdown,
    };
  }

  /**
   * Get redemption history for a customer.
   */
  async getRedemptionHistory(customerId: string, organizationId: string): Promise<{
    customerId: string;
    organizationId: string;
    totalSaved: number;
    redemptions: Array<{
      code: string;
      discountAmount: number;
      orderAmount: number;
      redeemedAt: Date;
    }>;
  }> {
    const redemptions = await this.prisma.promoRedemption.findMany({
      where: { customerId, organizationId },
      include: { promoCode: { select: { code: true } } },
      orderBy: { redeemedAt: 'desc' },
    });

    const totalSaved = redemptions.reduce(
      (sum, r) => sum + Number(r.discountAmount),
      0,
    );

    return {
      customerId,
      organizationId,
      totalSaved,
      redemptions: redemptions.map((r) => ({
        code: r.promoCode.code,
        discountAmount: Number(r.discountAmount),
        orderAmount: Number(r.orderAmount),
        redeemedAt: r.redeemedAt,
      })),
    };
  }

  // ─── Private Helpers ──────────────────────────────────

  private computeDiscount(
    orderAmount: number,
    discountType: string,
    discountValue: number,
    maxDiscount?: number,
  ): number {
    let discount = 0;

    switch (discountType) {
      case 'PERCENTAGE':
        discount = orderAmount * (discountValue / 100);
        break;
      case 'ABSOLUTE':
        discount = discountValue;
        break;
      case 'FREE_SHIPPING':
        discount = 0; // Free shipping is handled separately
        break;
      case 'BOGO':
        discount = orderAmount * 0.5; // Buy one get one = 50% off
        break;
      default:
        discount = 0;
    }

    // Cap at max discount if specified
    if (maxDiscount && discount > maxDiscount) {
      discount = maxDiscount;
    }

    // Cannot exceed order amount
    if (discount > orderAmount) {
      discount = orderAmount;
    }

    return Math.round(discount * 100) / 100;
  }
}