import { UnprocessableEntityException } from '@nestjs/common';
import { CurrencyResponseCodes } from '../enums/responseCodes';

export class CurrencyBucketNotFoundException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `Currency Bucket Not Found for this Organization`,
      errorCode: CurrencyResponseCodes.Currency_Bucket_Not_Found,
    });
  }
}

export class InvalidCurrencyException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `Invalid Currency`,
      errorCode: CurrencyResponseCodes.Invalid_Currency,
    });
  }
}

export class CurrencyBucketNotEmptyException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `Currency Bucket not empty. use force flag to do force removal.`,
      errorCode: CurrencyResponseCodes.Currency_Bucket_Not_Empty,
    });
  }
}

export class NotAuthorisedToCreateCurrencyException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `You are not authorized to create currency. Ask the Admin.`,
      errorCode: CurrencyResponseCodes.Not_Authorised_To_Create_Currency,
    });
  }
}
