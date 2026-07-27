import {
  IsString,
  IsNotEmpty,
  Min,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCurrencyForm {
  @ApiProperty({
    description: `Currency's currency code`,
    example: 'KFC',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  currencyCode!: string;

  @ApiProperty({
    description: `Currency's name`,
    example: 'KFC Reward Currency A',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  name!: string;
}

export class CreateOrgnizationCurrencyBucketForm {
  @ApiProperty({
    description: `Currency's currency code`,
    example: 'KFC',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  currencyCode!: string;
}

export interface handleAddNewCurrencyBucketToOrgJobData {
  currencyBucket: { code: string };
  organizationId: string;
}

export class AddBalanceToCurrencyBucketForm {
  @ApiProperty({
    description: `Currency's currency code`,
    example: 'KFC',
    type: String,
  })
  @IsNotEmpty({ message: 'Currency code must not be empty.' })
  @IsString({ message: 'Currency code must be a string.' })
  currencyCode: string;

  @ApiProperty({
    description: `Currency's amount to add`,
    example: 4,
    type: Number,
  })
  @IsNotEmpty({ message: 'Amount must not be empty.' })
  @IsNumber({}, { message: 'Amount must be a number.' })
  @Min(1, { message: 'Amount must be greater than 0.' }) // Assuming the smallest unit of currency and no negative amounts
  amount: number;
}

export class UpdateCurrencyBucketPropertiesForm {
  @ApiProperty({
    description: `Currency bucket id`,
    example: '87895-534u8695346-3636-363y7543',
    type: String,
  })
  @IsNotEmpty({ message: 'Currency bucket id must not be empty.' })
  @IsString({ message: 'Currency bucket id must be a string.' })
  id: string;

  @ApiProperty({
    description: `Indicates if auto top-up is enabled`,
    example: true,
    type: Boolean,
  })
  @IsBoolean({ message: 'Auto top-up enabled must be a boolean.' })
  autoTopUpEnabled = false;

  @ApiProperty({
    description: `Trigger balance for top-up`,
    example: 100,
    type: Number,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  autoTopUpThreshold?: number;

  @ApiProperty({
    description: `Amount to top up`,
    example: 50,
    type: Number,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  autoTopUpAmount?: number;
}

export class RemoveCurrencyBucketForm {
  @ApiProperty({
    description: `Currency's currency code`,
    example: 'KFC',
    type: String,
  })
  @IsNotEmpty({ message: 'Currency code must not be empty.' })
  @IsString({ message: 'Currency code must be a string.' })
  currencyCode!: string;

  @ApiPropertyOptional({
    description: `Removing the non zero currency bucket flag`,
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean({ message: 'Force must be a boolean.' })
  force?: boolean;
}

export class GetOrgCurrenciesForm {
  @ApiProperty({
    description: `Organization's Id`,
    example: 'fmlkdsjfn982ceyr2h7rnyd089t34',
    type: String,
  })
  @IsString()
  organizationId!: string;
}

export class FilterOrgCreatedCurrenciesForm {
  @ApiProperty({
    description: `Organization's Id`,
    example: 'fmlkdsjfn982ceyr2h7rnyd089t34',
    type: [String],
  })
  @IsArray()
  currencyCodes!: string[];
}
