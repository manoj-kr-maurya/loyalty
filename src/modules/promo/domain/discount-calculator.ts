export type PromoDiscountType =
  | 'PERCENTAGE'
  | 'ABSOLUTE'
  | 'FREE_SHIPPING'
  | 'BOGO';

export function calculatePromoDiscount(
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
      discount = 0;
      break;
    case 'BOGO':
      discount = orderAmount * 0.5;
      break;
    default:
      discount = 0;
  }

  if (maxDiscount && discount > maxDiscount) {
    discount = maxDiscount;
  }

  if (!Number.isFinite(discount) || discount < 0) {
    discount = 0;
  }

  if (discount > orderAmount) {
    discount = orderAmount;
  }

  return Math.round(discount * 100) / 100;
}
