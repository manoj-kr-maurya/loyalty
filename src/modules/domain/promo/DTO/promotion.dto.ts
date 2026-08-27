import { ApiProperty } from '@nestjs/swagger';
import * as Joi from 'joi';

export class PromotionDto {
  @ApiProperty() organizationId: string;
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiProperty() couponCode: string;
  @ApiProperty() couponValue: number;
  @ApiProperty() subTitle: string;
  @ApiProperty() rewardType: string;
  @ApiProperty() minBankAmount: number;
  @ApiProperty() minimumCartValue: number;
  @ApiProperty() maxDiscountValue: number;
  @ApiProperty() businessType: string[];
  @ApiProperty() maxClaimsPerUser: number;
  @ApiProperty() maxClaimsTotal: number;
  @ApiProperty() validFrom: string;
  @ApiProperty() validTo: string;
  @ApiProperty() eligibilityCriteria: any;
}

export const PromotionSchema = Joi.object({
  organizationId: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  couponCode: Joi.string().alphanum().max(20).optional(),
  couponValue: Joi.number().min(0).optional(),
  subTitle: Joi.string().max(200).optional(),
  rewardType: Joi.string().required(),
  minBankAmount: Joi.number().min(0).optional(),
  minimumCartValue: Joi.number().min(0).optional(),
  maxDiscountValue: Joi.number().min(0).optional(),
  businessType: Joi.array().items(Joi.string()).optional(),
  maxClaimsPerUser: Joi.number().integer().min(1).optional(),
  maxClaimsTotal: Joi.number().integer().min(1).optional(),
  validFrom: Joi.string().required(),
  validTo: Joi.string().required(),
  eligibilityCriteria: Joi.any().optional(),
}).unknown(true);
