import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';

export class UpdateShopForm {
  @ApiProperty({ type: String }) shopId: string;
  @ApiPropertyOptional({ type: String }) name?: string;
  @ApiPropertyOptional({ type: String }) address?: string;
  @ApiPropertyOptional({ type: String }) upiURI?: string;
  @ApiPropertyOptional({ type: String }) contactUs?: string;
  @ApiPropertyOptional({ type: String }) operationalHours?: string;
  @ApiPropertyOptional({ type: String }) aboutUs?: string;
}

export const UpdateShopSchema = Joi.object({
  shopId: Joi.string().required(),
  name: Joi.string().optional(),
  address: Joi.string().optional(),
  upiURI: Joi.string().optional(),
  contactUs: Joi.string().optional(),
  operationalHours: Joi.string().optional(),
  aboutUs: Joi.string().optional(),
  organizationId: Joi.string().optional(),
}).unknown(true);
