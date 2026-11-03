import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationRoles } from '@prisma/client';
import * as Joi from 'joi';

export class LoginOrganizationOtpForm {
  @ApiProperty({ description: `Country code`, example: '91', type: String })
  countryCode: string;

  @ApiProperty({
    description: `Phone number`,
    example: '9898989898',
    type: String,
  })
  phoneNumber: string;

  @ApiPropertyOptional({ description: `Name`, example: 'X', type: String })
  name?: string;

  @ApiPropertyOptional({
    enum: OrganizationRoles,
    example: OrganizationRoles.ADMIN,
  })
  role?: OrganizationRoles;

  @ApiPropertyOptional({ description: `Admin ID`, example: 'X', type: String })
  orgAdminId?: string;
}

export class GetYourOrganizationQuery {
  @ApiProperty({ description: `Admin ID`, example: 'X', type: String })
  orgAdminId: string;
}

export class ValidateOrganizationOtpForm {
  @ApiProperty({ description: `OTP`, example: '123456', type: String })
  otp: string;

  @ApiProperty({ description: `Organization ID`, type: String })
  id!: string;
}

export class UpdateOrganizationForm {
  @ApiPropertyOptional({ type: String }) name?: string;
  @ApiPropertyOptional({ type: String }) address?: string;
  @ApiPropertyOptional({ type: String }) base64Logo?: string;
  @ApiPropertyOptional({ type: String }) base64Cover?: string;
  @ApiPropertyOptional({ type: String }) upiURI?: string;
  @ApiPropertyOptional({ type: String }) contactUs?: string;
  @ApiPropertyOptional({ type: String }) operationalHours?: string;
  @ApiPropertyOptional({ type: String }) aboutUs?: string;
}

export class SendInterestForm {
  @ApiProperty({
    description: `Phone number`,
    example: '9899096444',
    type: String,
  })
  phoneNumber!: string;
}

export class SetCredentialsForm {
  @ApiProperty({
    description: `Username the staff member logs in with`,
    example: 'jas.retail',
    type: String,
  })
  username!: string;

  @ApiProperty({
    description: `Password`,
    example: 'a-strong-password',
    type: String,
  })
  password!: string;
}

export class LoginWithCredentialsForm {
  @ApiProperty({
    description: `Username the staff member logs in with`,
    example: 'jas.retail',
    type: String,
  })
  username!: string;

  @ApiProperty({
    description: `Password`,
    example: 'a-strong-password',
    type: String,
  })
  password!: string;
}

export class VerifyLoginChallengeForm {
  @ApiProperty({
    description: `Challenge id returned by the login call`,
    example: 'm1k2j3-abcdef',
    type: String,
  })
  challengeId!: string;

  @ApiProperty({ description: `OTP`, example: '123456', type: String })
  otp!: string;
}

export class InviteShopForm {
  @ApiProperty({
    description: `Phone number`,
    example: '9899096444',
    type: String,
  })
  phoneNumber!: string;

  @ApiProperty({
    description: `Shop location`,
    example: 'Ambala, Haryana',
    type: String,
  })
  location!: string;
}

export const LoginOrganizationOtpSchema = Joi.object({
  countryCode: Joi.string().required(),
  phoneNumber: Joi.string().required(),
  name: Joi.string().optional(),
  role: Joi.string()
    .valid(...Object.values(OrganizationRoles))
    .optional(),
  orgAdminId: Joi.string().optional(),
});

export const GetYourOrganizationSchema = Joi.object({
  orgAdminId: Joi.string().required(),
  organizationId: Joi.string().optional(),
}).unknown(true);

export const ValidateOrganizationOtpSchema = Joi.object({
  otp: Joi.string().required(),
  id: Joi.string().required(),
});

export const UpdateOrganizationSchema = Joi.object({
  organizationId: Joi.string().optional(),
  name: Joi.string().optional(),
  address: Joi.string().optional(),
  base64Logo: Joi.string().optional(),
  base64Cover: Joi.string().optional(),
  upiURI: Joi.string().optional(),
  contactUs: Joi.string().optional(),
  operationalHours: Joi.string().optional(),
  aboutUs: Joi.string().optional(),
}).unknown(true);

export const SendInterestSchema = Joi.object({
  phoneNumber: Joi.string().required(),
});

export const InviteShopSchema = Joi.object({
  organizationId: Joi.string().optional(),
  phoneNumber: Joi.string().required(),
  location: Joi.string().max(100).required(),
}).unknown(true);

export const SetCredentialsSchema = Joi.object({
  username: Joi.string().min(3).max(64).required(),
  password: Joi.string().min(8).max(128).required(),
}).unknown(false);

export const LoginWithCredentialsSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
}).unknown(false);

export const VerifyLoginChallengeSchema = Joi.object({
  challengeId: Joi.string().required(),
  otp: Joi.string().required(),
}).unknown(false);
