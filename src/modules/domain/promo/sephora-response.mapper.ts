import { Injectable } from '@nestjs/common';
import { CouponValidationResult } from './coupon-validator.service';

export interface SephoraCoupon {
  coupon_type: string;
  coupon_value: number;
  coupon_code: string;
  title: string;
  sub_title: string;
  message: string;
  description: string;
  max_discount_value: number;
  minimum_cart_value: number;
  is_applicable: boolean;
  is_applied: boolean;
  expires_on: string;
  expires_at: string;
  is_bank_offer: boolean;
  offer_text: string;
  coupon_amount: number;
  coupon_applicable_message: string;
  coupon_id: string;
}

export interface SephoraPage {
  current: number;
  total: number;
  has_previous: boolean;
  has_next: boolean;
  total_item_count: number;
}

export interface SephoraPromoResponse {
  available_coupon_list: SephoraCoupon[];
  page: SephoraPage;
}

@Injectable()
export class SephoraResponseMapper {
  mapCouponType(rewardType: string): string {
    const typeMap: Record<string, string> = {
      DISCOUNT: 'absolute',
      PERCENTAGE: 'percentage',
      BUNDLE: 'bundle',
      CASHBACK: 'percentage',
      BUY_X_GET_Y: 'bundle',
    };
    return typeMap[rewardType] ?? 'absolute';
  }

  formatExpiryDate(date: Date | string): string {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `Valid till ${day < 10 ? '0' + day : day} ${month}, ${year}`;
  }

  buildOfferText(rewardType: string, value: number, rules: any[]): string {
    const type = this.mapCouponType(rewardType);
    if (type === 'absolute') return `${value} RS OFF`;
    if (type === 'percentage') return `${value} % OFF`;
    if (type === 'bundle') {
      const threshold = rules?.[0]?.threshold ?? 0;
      const ratioBase = rules?.[0]?.ratioBase ?? 1;
      return `Buy ${ratioBase} Items Get ${value} % OFF`;
    }
    return `${value} OFF`;
  }

  mapPromoToCoupon(
    promo: any,
    validation: CouponValidationResult,
  ): SephoraCoupon {
    const rules = promo.rules ?? [];
    const couponValue = promo.couponValue ? Number(promo.couponValue) : 0;
    const rewardType = promo.rewardType ?? 'DISCOUNT';
    const couponType = this.mapCouponType(rewardType);
    const businessTypes = (promo.businessType as string[]) ?? [];

    return {
      coupon_type: couponType,
      coupon_value: couponType === 'absolute' ? couponValue : 0,
      coupon_code: promo.couponCode ?? promo.id.slice(0, 8).toUpperCase(),
      title: promo.name ?? '',
      sub_title: promo.subTitle ?? promo.description ?? '',
      message: promo.description ?? promo.name ?? '',
      description: promo.description ?? '',
      max_discount_value: promo.maxDiscountValue ? Number(promo.maxDiscountValue) : 0,
      minimum_cart_value: promo.minimumCartValue ? Number(promo.minimumCartValue) : 0,
      is_applicable: validation.isApplicable,
      is_applied: validation.isApplied,
      expires_on: promo.endDate ? this.formatExpiryDate(promo.endDate) : '',
      expires_at: promo.endDate ? new Date(promo.endDate).toISOString() : '',
      is_bank_offer: businessTypes.some((t: string) => t.toLowerCase().includes('bank')),
      offer_text: this.buildOfferText(rewardType, couponValue, rules),
      coupon_amount: couponValue,
      coupon_applicable_message: validation.couponApplicableMessage,
      coupon_id: promo.id,
    };
  }

  mapToResponse(
    promos: any[],
    validations: Map<string, CouponValidationResult>,
    page: number,
    limit: number,
  ): SephoraPromoResponse {
    const coupons = promos.map((promo) => {
      const validation = validations.get(promo.id) ?? {
        isApplicable: false,
        isApplied: false,
        couponApplicableMessage: 'Unable to validate',
      };
      return this.mapPromoToCoupon(promo, validation);
    });

    const total = coupons.length;
    const totalPages = Math.ceil(total / limit);

    return {
      available_coupon_list: coupons,
      page: {
        current: page,
        total: totalPages || 1,
        has_previous: page > 1,
        has_next: page < totalPages,
        total_item_count: total,
      },
    };
  }
}
