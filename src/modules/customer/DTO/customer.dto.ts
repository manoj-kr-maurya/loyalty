import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';

export class OtpPhoneFindOrCreateCustomerForm {
  @ApiProperty({ description: `Country code`, example: '91', type: String })
  countryCode!: string;

  @ApiProperty({
    description: `Phone number`,
    example: '9898989898',
    type: String,
  })
  phoneNumber!: string;

  @ApiPropertyOptional({ description: `Name`, example: 'Y', type: String })
  name?: string;

  @ApiPropertyOptional({
    description: `Organization the customer belongs to`,
    type: String,
  })
  organizationId?: string;
}

export class CustomerSessionForm {
  @ApiPropertyOptional({
    description: `Identifier the tenant uses for this customer`,
    example: 'cust_12345',
    type: String,
  })
  externalId?: string;

  @ApiPropertyOptional({
    description: `Phone number of the customer`,
    example: '9898989898',
    type: String,
  })
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: `Country code`,
    example: '91',
    type: String,
  })
  countryCode?: string;

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
  organizationId: Joi.string().optional(),
});

export const CustomerSessionSchema = Joi.object({
  externalId: Joi.string().optional(),
  phoneNumber: Joi.string().optional(),
  countryCode: Joi.string().optional(),
  name: Joi.string().optional(),
})
  .or('externalId', 'phoneNumber')
  .unknown(false);

export const OtpValidateOtpSchema = Joi.object({
  id: Joi.string().required(),
  otp: Joi.string().required(),
});

export const UpdateCustomerSchema = Joi.object({
  customerId: Joi.string().required(),
  name: Joi.string().optional(),
  base64Logo: Joi.string().optional(),
}).unknown(true);

export const UpdateMyProfileSchema = Joi.object({
  name: Joi.string().min(1).max(120).optional(),
}).unknown(false);

export const MyStatementQuerySchema = Joi.object({
  currencyCode: Joi.string().required(),
}).unknown(true);

export const LogoutCustomerSchema = Joi.object({
  customerId: Joi.string().required(),
});
