import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OtpPhoneFindOrCreateCustomerForm {
  @ApiProperty({
    description: `Customer's country code for phone number`,
    example: '91',
    type: String,
  })
  @IsString()
  countryCode!: string;

  @ApiProperty({
    description: `Customer's phone number`,
    example: '9898989898',
    type: String,
  })
  @IsString()
  phoneNumber!: string;

  @ApiPropertyOptional({
    description: `Customer's name`,
    example: 'Y',
    type: String,
  })
  @IsOptional()
  @IsString()
  name?: string;
}

export class OtpValidateOtpBodyForm {
  @ApiProperty({
    description: `customer's id`,
    example: '9cbr237fnyb283yfc983d',
    type: String,
  })
  @IsString()
  id?: string;
  @ApiProperty({
    description: `customer's otp to continue`,
    example: '1W3R56',
    type: String,
  })
  @IsString()
  otp: string;
}

export class AddOrSubtractLoyaltyBodyForm {
  @ApiProperty({
    description: `Customer's Id`,
    example: '769827nc892r37bc9480r7b',
    type: String,
  })
  @IsString()
  customerId: string;

  @ApiProperty({
    description: `Organization's Id`,
    example: 'r7489rybd893749038ry3v89',
    type: String,
  })
  @IsString()
  organizationId: string;

  @ApiProperty({
    description: `loyalty to add`,
    example: 69,
    type: Number,
  })
  @IsString()
  loyalty: number;
}

export class GetCustomerParams {
  @IsNotEmpty()
  customerId: string;
}

export class UpdateCustomerForm {
  @ApiPropertyOptional({
    description: `Customer's name`,
    example: 'X',
    type: String,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: `Customer's logo in base 64`,
    example: 'Xniwqjdnqwd',
    type: String,
  })
  @IsOptional()
  @IsString()
  base64Logo?: string;
}
