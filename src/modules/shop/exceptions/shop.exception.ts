import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ShopResponseCodes } from '../enums/responseCodes';

export class ShopNotFoundException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `Shop not found`,
      errorCode: ShopResponseCodes.Shop_Not_Found,
    });
  }
}

export class UnauthorizedShopUpdateException extends ConflictException {
  constructor() {
    super({
      error: `You are not authorized to update this shop`,
      errorCode: ShopResponseCodes.Unauthorized_Shop_Update,
    });
  }
}
