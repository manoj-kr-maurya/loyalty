import {
  UnauthorizedException,
  UnprocessableEntityException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CommonResponseCodes } from './enum';

export class CommonException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ error: message, errorCode: CommonResponseCodes.Generic_Error }, status);
  }
}

export class InvalidJWTException extends UnauthorizedException {
  constructor() {
    super({
      error: `Invalid JWT`,
      errorCode: CommonResponseCodes.Invalid_JWT,
    });
  }
}

export class InvalidSessionException extends UnauthorizedException {
  constructor() {
    super({
      error: `Invalid Session`,
      errorCode: CommonResponseCodes.Invalid_JWT,
    });
  }
}

export class UsedInviteCodeException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `Used Invite code`,
      errorCode: CommonResponseCodes.Used_Invite_Code,
    });
  }
}

export class InviteCodeNotFoundException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `Invite code not found`,
      errorCode: CommonResponseCodes.Invite_Code_Not_Found,
    });
  }
}

export class ShopInvitesNotFoundException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `shop invites not found`,
      errorCode: CommonResponseCodes.Shops_Invite_Not_Found,
    });
  }
}

export class SmsTemplateNotFoundException extends UnprocessableEntityException {
  constructor() {
    super({
      error: `Sms Template not found`,
      errorCode: CommonResponseCodes.Sms_Template_Not_Found,
    });
  }
}

export class TooManyAttemptsException extends UnauthorizedException {
  constructor() {
    super({
      error: `Too many attempts. Please try again later.`,
      errorCode: CommonResponseCodes.Too_Many_Attempts,
    });
  }
}
