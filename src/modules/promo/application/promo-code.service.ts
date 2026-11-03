import { Injectable, Logger } from '@nestjs/common';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';
import { PromoCodeRepository } from '../infrastructure/promo-code.repository';
import { calculatePromoDiscount } from '../domain/discount-calculator';

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
export class PromoCodeService {
  private readonly logger = new Logger(PromoCodeService.name);

  constructor(private readonly promoCodeRepository: PromoCodeRepository) {}

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
    const existing = await this.promoCodeRepository.findUnique(code);

    if (existing) {
      throw new CommonException(
        `Promo code "${code}" already exists`,
        StatusCodes.CONFLICT,
      );
    }

    // Validate dates
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate >= endDate
    ) {
      throw new CommonException(
        'startDate must be before endDate',
        StatusCodes.BAD_REQUEST,
      );
    }

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      throw new CommonException(
        'discountValue must be greater than zero',
        StatusCodes.BAD_REQUEST,
      );
    }
    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      throw new CommonException(
        'Percentage discount must be between 0 and 100',
        StatusCodes.BAD_REQUEST,
      );
    }
    if (
      !['PERCENTAGE', 'ABSOLUTE', 'FREE_SHIPPING', 'BOGO'].includes(
        discountType,
      )
    ) {
      throw new CommonException(
        'Unsupported discountType',
        StatusCodes.BAD_REQUEST,
      );
    }
    for (const [name, value] of Object.entries({
      minOrderAmount,
      maxDiscount,
      usageLimit,
      perUserLimit,
    })) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new CommonException(
          `${name} must be a non-negative number`,
          StatusCodes.BAD_REQUEST,
        );
      }
    }

    const promoCode = await this.promoCodeRepository.create({
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
    });

    this.logger.log(
      `Promo code created: ${code} (${discountType} ${discountValue})`,
    );

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
  async validatePromoCode(
    input: ValidatePromoCodeInput,
  ): Promise<ValidatePromoCodeOutput> {
    const { code, organizationId, customerId, orderAmount, productIds } = input;

    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      throw new CommonException(
        'orderAmount must be greater than zero',
        StatusCodes.BAD_REQUEST,
      );
    }

    const promoCode = await this.promoCodeRepository.findUnique(code);

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
    const userRedemptions = await this.promoCodeRepository.countRedemptions(
      promoCode.id,
      customerId,
    );

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
    if (
      promoCode.minOrderAmount &&
      orderAmount < Number(promoCode.minOrderAmount)
    ) {
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
        const hasApplicable = productIds.some((pid) =>
          applicableProducts.includes(pid),
        );
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
    const calculatedDiscount = calculatePromoDiscount(
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
  async redeemPromoCode(
    input: RedeemPromoCodeInput,
  ): Promise<RedeemPromoCodeOutput> {
    const { code, organizationId, customerId, orderAmount, orderRef } = input;

    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      throw new CommonException(
        'orderAmount must be greater than zero',
        StatusCodes.BAD_REQUEST,
      );
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await this.promoCodeRepository.runSerializable(
          async (repository) => {
            const promoCode = await repository.findUnique(code);
            if (!promoCode) {
              throw new CommonException(
                'Promo code not found',
                StatusCodes.NOT_FOUND,
              );
            }

            const now = new Date();
            if (
              !promoCode.isActive ||
              promoCode.organizationId !== organizationId ||
              now < promoCode.startDate ||
              now > promoCode.endDate
            ) {
              throw new CommonException(
                'Promo code is not valid for this organization or time',
                StatusCodes.BAD_REQUEST,
              );
            }
            if (
              promoCode.usageLimit &&
              promoCode.usedCount >= promoCode.usageLimit
            ) {
              throw new CommonException(
                'Promo code usage limit reached',
                StatusCodes.BAD_REQUEST,
              );
            }
            if (
              promoCode.minOrderAmount &&
              orderAmount < Number(promoCode.minOrderAmount)
            ) {
              throw new CommonException(
                `Minimum order amount of ${promoCode.minOrderAmount} required`,
                StatusCodes.BAD_REQUEST,
              );
            }

            const userRedemptions = await repository.countRedemptions(
              promoCode.id,
              customerId,
            );
            if (
              promoCode.perUserLimit &&
              userRedemptions >= promoCode.perUserLimit
            ) {
              throw new CommonException(
                'You have already used this promo code',
                StatusCodes.BAD_REQUEST,
              );
            }

            const discountAmount = calculatePromoDiscount(
              orderAmount,
              promoCode.discountType,
              Number(promoCode.discountValue),
              promoCode.maxDiscount ? Number(promoCode.maxDiscount) : undefined,
            );

            const redemption = await repository.createRedemption({
              promoCodeId: promoCode.id,
              customerId,
              organizationId,
              orderRef,
              discountAmount,
              orderAmount,
            });

            await repository.incrementUsedCount(promoCode.id);

            return {
              discountAmount,
              finalAmount: orderAmount - discountAmount,
              redemptionId: redemption.id,
            };
          },
        );

        this.logger.log(
          `Promo redeemed: ${code} by ${customerId} discount=${result.discountAmount}`,
        );

        return { success: true, code, ...result };
      } catch (error) {
        if ((error as { code?: string })?.code === 'P2034') {
          if (attempt < 3) {
            continue;
          }
        } else {
          throw error;
        }
      }
    }

    throw new CommonException(
      'Promo redemption could not be completed, please retry',
      StatusCodes.CONFLICT,
    );
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

    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      throw new CommonException(
        'orderAmount must be greater than zero',
        StatusCodes.BAD_REQUEST,
      );
    }

    const uniqueCodes = [...new Set(codes)];
    if (uniqueCodes.length !== codes.length) {
      return {
        applicable: false,
        codes,
        totalDiscount: 0,
        finalAmount: orderAmount,
        breakdown: [],
      };
    }

    const promoCodes = await this.promoCodeRepository.findCodesForStacking(
      uniqueCodes,
      organizationId,
      customerId,
    );

    const now = new Date();
    const allValid =
      promoCodes.length === uniqueCodes.length &&
      promoCodes.every(
        (promoCode) =>
          promoCode.isActive &&
          now >= promoCode.startDate &&
          now <= promoCode.endDate &&
          !(
            promoCode.usageLimit && promoCode.usedCount >= promoCode.usageLimit
          ) &&
          !(
            promoCode.perUserLimit &&
            promoCode.redemptions.length >= promoCode.perUserLimit
          ) &&
          !(
            promoCode.minOrderAmount &&
            orderAmount < Number(promoCode.minOrderAmount)
          ),
      );

    if (!allValid) {
      return {
        applicable: false,
        codes,
        totalDiscount: 0,
        finalAmount: orderAmount,
        breakdown: [],
      };
    }

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
    const breakdown: Array<{
      code: string;
      discountType: string;
      discountAmount: number;
    }> = [];

    for (const promoCode of promoCodes) {
      const discount = calculatePromoDiscount(
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
  async getRedemptionHistory(
    customerId: string,
    organizationId: string,
  ): Promise<{
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
    const redemptions = await this.promoCodeRepository.findRedemptions(
      customerId,
      organizationId,
    );

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
}
