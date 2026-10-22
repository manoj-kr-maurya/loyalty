import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';

export class CreateCurrencyForm {
  @ApiProperty({ description: `Currency code`, example: 'KFC', type: String })
  currencyCode!: string;

  @ApiProperty({ description: `Currency name`, example: 'KFC Reward', type: String })
  name!: string;
}

export class CreateOrgnizationCurrencyBucketForm {
  @ApiProperty({ description: `Currency code`, example: 'KFC', type: String })
  currencyCode!: string;
}

export interface handleAddNewCurrencyBucketToOrgJobData {
  currencyBucket: { code: string };
  organizationId: string;
}

export class AddBalanceToCurrencyBucketForm {
  @ApiProperty({ description: `Currency code`, example: 'KFC', type: String })
  currencyCode: string;

  @ApiProperty({ description: `Amount to add`, example: 4, type: Number })
  amount: number;
}

export class UpdateCurrencyBucketPropertiesForm {
  @ApiProperty({ type: String }) id: string;
  @ApiProperty({ type: Boolean }) autoTopUpEnabled = false;
  @ApiPropertyOptional({ type: Number }) autoTopUpThreshold?: number;
  @ApiPropertyOptional({ type: Number }) autoTopUpAmount?: number;
}

export class RemoveCurrencyBucketForm {
  @ApiProperty({ type: String }) currencyCode!: string;
  @ApiPropertyOptional({ type: Boolean }) force?: boolean;
}

export class GetOrgCurrenciesForm {
  @ApiProperty({ type: String }) organizationId!: string;
}

export class FilterOrgCreatedCurrenciesForm {
  @ApiProperty({ type: [String] }) currencyCodes!: string[];
}

export const CreateCurrencySchema = Joi.object({
  organizationId: Joi.string().optional(),
  currencyCode: Joi.string().required(),
  name: Joi.string().required(),
}).unknown(true);

export const CreateOrgCurrencyBucketSchema = Joi.object({
  organizationId: Joi.string().optional(),
  currencyCode: Joi.string().required(),
}).unknown(true);

export const AddBalanceSchema = Joi.object({
  organizationId: Joi.string().optional(),
  currencyCode: Joi.string().required(),
  amount: Joi.number().min(1).required(),
}).unknown(true);

export const UpdateBucketPropertiesSchema = Joi.object({
  id: Joi.string().required(),
  autoTopUpEnabled: Joi.boolean().required(),
  autoTopUpThreshold: Joi.number().optional(),
  autoTopUpAmount: Joi.number().optional(),
});

export const FilterOrgCurrenciesSchema = Joi.object({
  organizationId: Joi.string().optional(),
  currencyCodes: Joi.array().items(Joi.string()).required(),
}).unknown(true);
