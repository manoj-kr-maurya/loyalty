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
  @ApiProperty() attributes: Record<string, any>;
  @ApiProperty() channels: string[];
  @ApiProperty() validFrom: string;
  @ApiProperty() validTo: string;
  @ApiProperty() eligibilityCriteria: any;
}

export const PromotionSchema = Joi.object({
  organizationId: Joi.string().optional(),
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
  attributes: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
  channels: Joi.array()
    .items(Joi.string().valid('app', 'web', 'mweb', 'all'))
    .optional(),
  validFrom: Joi.string().required(),
  validTo: Joi.string().required(),
  eligibilityCriteria: Joi.any().optional(),
}).unknown(true);

export class CouponCheckDto {
  @ApiProperty() organizationId: string;
  @ApiProperty() couponId?: string;
  @ApiProperty() couponCode?: string;
  @ApiProperty() customerId?: string;
  @ApiProperty() cartValue: number;
  @ApiProperty() currency?: string;
  @ApiProperty() cartCategories?: string[];
  @ApiProperty() isBankOffer?: boolean;
  @ApiProperty() channel?: string;
  @ApiProperty() context?: Record<string, any>;
}

export const CouponCheckSchema = Joi.object({
  organizationId: Joi.string().required(),
  couponId: Joi.string().optional(),
  couponCode: Joi.string().optional(),
  customerId: Joi.string().optional(),
  cartValue: Joi.number().min(0).required(),
  currency: Joi.string().optional(),
  cartCategories: Joi.array().items(Joi.string()).optional(),
  isBankOffer: Joi.boolean().optional(),
  channel: Joi.string().valid('app', 'web', 'mweb').optional(),
  context: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
}).unknown(true);

export class GetActivePromotionsDto {
  @ApiProperty() organizationId: string;
  @ApiProperty() customerId?: string;
  @ApiProperty() cartValue?: number;
  @ApiProperty() cartCategories?: string[];
  @ApiProperty() isBankOffer?: boolean;
  @ApiProperty() channel?: string;
  @ApiProperty() page?: number;
  @ApiProperty() limit?: number;
}

export const GetActivePromotionsSchema = Joi.object({
  organizationId: Joi.string().required(),
  customerId: Joi.string().optional(),
  cartValue: Joi.number().min(0).optional(),
  cartCategories: Joi.array().items(Joi.string()).optional(),
  isBankOffer: Joi.boolean().optional(),
  channel: Joi.string().valid('app', 'web', 'mweb').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
}).unknown(true);
