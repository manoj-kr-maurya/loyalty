import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationRoles } from '@prisma/client';

export class LoginOrganizationOtpForm {
  @ApiProperty({
    description: `Organization's country code for phone number`,
    example: '91',
    type: String,
  })
  @IsString()
  countryCode: string;

  @ApiProperty({
    description: `Organization's phone number`,
    example: '9898989898',
    type: String,
  })
  @IsString()
  phoneNumber: string;

  @ApiPropertyOptional({
    description: `Organization's name`,
    example: 'X',
    type: String,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: `organization's user's role`,
    enum: OrganizationRoles,
    type: String,
    example: OrganizationRoles.ADMIN,
  })
  @IsOptional()
  @IsEnum(OrganizationRoles)
  role?: OrganizationRoles;

  @ApiPropertyOptional({
    description: `Organization's Admin ID`,
    example: 'X',
    type: String,
  })
  @IsOptional()
  @IsString()
  orgAdminId?: string;
}

export class GetYourOrganizationQuery {
  @ApiProperty({
    description: `organization's otp to continue`,
    example: '1W3R56',
    type: String,
  })
  @IsString()
  orgAdminId: string;
}

export class ValidateOrganizationOtpForm {
  @ApiProperty({
    description: `organization's otp to continue`,
    example: '1W3R56',
    type: String,
  })
  @IsString()
  otp: string;
  @ApiProperty({
    description: `Organization's Id`,
    example: 'fmlkdsjfn982ceyr2h7rnyd089t34',
    type: String,
  })
  @IsString()
  id!: string;
}

export class UpdateOrganizationForm {
  @ApiPropertyOptional({
    description: `Organization's name`,
    example: 'X',
    type: String,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: `Organization's address`,
    example: 'Xniwqjdnqwd',
    type: String,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: `Organization's logo in base 64`,
    example: 'Xniwqjdnqwd',
    type: String,
  })
  @IsOptional()
  @IsString()
  base64Logo?: string;

  @ApiPropertyOptional({
    description: `Organization's cover in base 64`,
    example: 'Xniwqjdnqwd',
    type: String,
  })
  @IsOptional()
  @IsString()
  base64Cover?: string;

  @ApiPropertyOptional({
    description: `Organization's upi id`,
    example: '9999999999@bank',
    type: String,
  })
  @IsOptional()
  @IsString()
  upiURI?: string;

  @ApiPropertyOptional({
    description: `orgs contact us`,
    example: '9999999999@bank',
    type: String,
  })
  @IsOptional()
  @IsString()
  contactUs?: string;

  @ApiPropertyOptional({
    description: `Organization's in their own words, operational hours`,
    example: '9999999999@bank',
    type: String,
  })
  @IsOptional()
  @IsString()
  operationalHours?: string;

  @ApiPropertyOptional({
    description: `Organization's about us`,
    example: '9999999999@bank',
    type: String,
  })
  @IsOptional()
  @IsString()
  aboutUs?: string;
}

export class SendInterestForm {
  @ApiProperty({
    description: `phone number`,
    example: '9899096444',
    type: String,
  })
  @IsString()
  phoneNumber!: string;
}

export class InviteShopForm {
  @ApiProperty({
    description: `phone number`,
    example: '9899096444',
    type: String,
  })
  @IsString()
  phoneNumber!: string;

  @ApiProperty({
    description: `Shop location`,
    example: 'Ambala, Haryana',
    type: String,
  })
  @IsString()
  @MaxLength(100)
  location!: string;
}
