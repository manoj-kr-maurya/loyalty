import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrganizationResponseCodes } from '../enums/responseCodes';

export class InvalidOrganizationException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `Invalid Organization`,
      errorCode: OrganizationResponseCodes.Invalid_Organization,
    });
  }
}

export class CurrencyDoesNotExistsForThisOrganizationException extends ConflictException {
  constructor() {
    super({
      error: `Currency Does Not Exists for this organization.`,
      errorCode: OrganizationResponseCodes.Currency_Does_Not_Exist,
    });
  }
}

export class CurrencyBucketAlreadyInitialiedForThisOrganizationException extends ConflictException {
  constructor() {
    super({
      error: `Currency Bucket Already Initialized for this organization.`,
      errorCode:
        OrganizationResponseCodes.Organization_Same_Currency_Already_Exists,
    });
  }
}

export class WrongOrganizationOtpException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `Incorrect OTP.`,
      errorCode: OrganizationResponseCodes.Organization_Otp_Incorrect,
    });
  }
}

export class InvalidAdminOrganizationException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `Invalid Admin Organization`,
      errorCode: OrganizationResponseCodes.Invalid_Admin_Organization_Exception,
    });
  }
}
