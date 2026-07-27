import { ConflictException } from '@nestjs/common';
import { customerOrganizationOrderResponseCodes } from '../enums/responseCodes';

export class OrderNotFound extends ConflictException {
  constructor() {
    super({
      error: `Order not found with this reference`,
      errorCode: customerOrganizationOrderResponseCodes.Order_Not_Found,
    });
  }
}

export class OrganizationDoesntHaveEnoughCurrency extends ConflictException {
  constructor() {
    super({
      error: `Organization does not have enough currency`,
      errorCode: customerOrganizationOrderResponseCodes.Not_Enough_Currency,
    });
  }
}

export class InsufficientPointsException extends ConflictException {
  constructor(insufficientPoints: { currencyCode: string }[]) {
    super({
      error: `Insufficient points for currencies: ${insufficientPoints
        .map((coin) => coin.currencyCode)
        .join(', ')}`,
      errorCode: customerOrganizationOrderResponseCodes.Insufficient_Points,
    });
  }
}

export class InvalidAmountException extends ConflictException {
  constructor(
    calculatedTotal: number,
    burningDetails?: { totalAmount: number; cash: { amount: number } },
  ) {
    super({
      error: `Total amount (${
        burningDetails.totalAmount
      }) doesn't match the sum of cash (${
        burningDetails.cash.amount
      }) and coins (${calculatedTotal - burningDetails.cash.amount})`,
      errorCode: customerOrganizationOrderResponseCodes.Invalid_Amount,
    });
  }
}
