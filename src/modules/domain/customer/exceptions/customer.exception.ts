import { UnprocessableEntityException } from '@nestjs/common';
import { CustomerResponseCodes } from '../enums/responseCodes';

export class WrongCustomerOtpException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `Incorrect OTP.`,
      errorCode: CustomerResponseCodes.Customer_Otp_Incorrect,
    });
  }
}
