import { ApiProperty } from '@nestjs/swagger';
import * as Joi from 'joi';

export class RewardCalculationDto {
  @ApiProperty() customer: any;
  @ApiProperty() cart: any;
  @ApiProperty() payment: any;
  @ApiProperty() merchant: any;
  @ApiProperty() channel: any;
  @ApiProperty() location: any;
}

export class BlockRewardDto {
  @ApiProperty() customer: any;
  @ApiProperty() cart: any;
  @ApiProperty() budget: number;
}

export class AwardRewardDto {
  @ApiProperty() blockId: string;
  @ApiProperty() payment: any;
  @ApiProperty() budget: number;
}

export class ReverseRewardDto {
  @ApiProperty() referenceId: string;
  @ApiProperty() reason: string;
}

export class ExpireRewardDto {
  @ApiProperty() programId?: string;
  @ApiProperty() cutoffDate: string;
}

export const RewardCalculationSchema = Joi.object({
  customer: Joi.object().optional(),
  cart: Joi.object().optional(),
  payment: Joi.object().optional(),
  merchant: Joi.object().optional(),
  channel: Joi.string().optional(),
  location: Joi.object().optional(),
  rules: Joi.array().optional(),
}).unknown(true);

export const BlockRewardSchema = Joi.object({
  customer: Joi.object().optional(),
  cart: Joi.object().optional(),
  budget: Joi.number().optional(),
  programId: Joi.string().optional(),
  amount: Joi.number().optional(),
  currency: Joi.string().optional(),
  reference: Joi.string().optional(),
  rules: Joi.array().optional(),
}).unknown(true);

export const AwardRewardSchema = Joi.object({
  blockId: Joi.string().optional(),
  payment: Joi.object().optional(),
  budget: Joi.number().optional(),
  programId: Joi.string().optional(),
  amount: Joi.number().optional(),
  currency: Joi.string().optional(),
  reference: Joi.string().optional(),
  rules: Joi.array().optional(),
}).unknown(true);

export const ReverseRewardSchema = Joi.object({
  referenceId: Joi.string().allow('').optional(),
  programId: Joi.string().allow('').optional(),
  customerId: Joi.string().allow('').optional(),
  reason: Joi.string().optional(),
}).unknown(true);

export const ExpireRewardSchema = Joi.object({
  programId: Joi.string().allow('').optional(),
  customerId: Joi.string().allow('').optional(),
  amount: Joi.number().optional(),
  cutoffDate: Joi.string().optional(),
}).unknown(true);
