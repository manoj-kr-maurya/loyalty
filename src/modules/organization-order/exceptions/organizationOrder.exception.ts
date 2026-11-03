import { ConflictException } from '@nestjs/common';
import { organizationOrderResponseCodes } from '../enums/responseCodes';

export class OrderNotFound extends ConflictException {
  constructor() {
    super({
      error: `Order not found with this reference`,
      errorCode: organizationOrderResponseCodes.Order_Not_Found,
    });
  }
}
