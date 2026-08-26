import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';

export class OtpPhoneFindOrCreateCustomerForm {
  @ApiProperty({ description: `Country code`, example: '91', type: String })
  countryCode!: string;

  @ApiProperty({ description: `Phone number`, example: '9898989898', type: String })
  phoneNumber!: string;

  @ApiPropertyOptional({ description: `Name`, example: 'Y', type: String })
  name?: string;
}

export class OtpValidateOtpBodyForm {
  @ApiProperty({ description: `Customer ID`, type: String })
  id?: string;

  @ApiProperty({ description: `OTP`, example: '123456', type: String })
  otp: string;
}

export class AddOrSubtractLoyaltyBodyForm {
  @ApiProperty({ type: String }) customerId: string;
  @ApiProperty({ type: String }) organizationId: string;
  @ApiProperty({ type: Number }) loyalty: number;
}

export class GetCustomerParams {
  customerId: string;
}

export class UpdateCustomerForm {
  @ApiPropertyOptional({ type: String }) name?: string;
  @ApiPropertyOptional({ type: String }) base64Logo?: string;
}

export const OtpPhoneFindOrCreateSchema = Joi.object({
  countryCode: Joi.string().required(),
  phoneNumber: Joi.string().required(),
  name: Joi.string().optional(),
});

export const OtpValidateOtpSchema = Joi.object({
  id: Joi.string().optional(),
  otp: Joi.string().required(),
});

export const UpdateCustomerSchema = Joi.object({
  customerId: Joi.string().optional(),
  name: Joi.string().optional(),
  base64Logo: Joi.string().optional(),
}).unknown(true);

export const LogoutCustomerSchema = Joi.object({
  customerId: Joi.string().required(),
});
