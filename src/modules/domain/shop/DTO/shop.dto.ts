import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateShopForm {
  @ApiProperty({
    description: `Organization's name`,
    example: 'X',
    type: String,
  })
  @IsString()
  shopId: string;
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
