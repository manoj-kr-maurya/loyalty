import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationOrderStatus, OrganizationOrderType } from '@prisma/client';
import * as Joi from 'joi';

interface CurrencyPurchaseDetails {
  currencyCode: string;
}

export class CreateOrderDto {
  @ApiProperty({ enum: OrganizationOrderType }) orderType!: OrganizationOrderType;
  @ApiPropertyOptional({ example: 100 }) amount?: number;
  @ApiProperty({ type: Object }) details!: CurrencyPurchaseDetails;
}

export class UpdateOrderDto {
  @ApiProperty({ enum: OrganizationOrderStatus }) newStatus?: OrganizationOrderStatus;
}

export const CreateOrganizationOrderSchema = Joi.object({
  organizationId: Joi.string().optional(),
  orderType: Joi.string().valid(...Object.values(OrganizationOrderType)).required(),
  amount: Joi.number().optional(),
  details: Joi.object().required(),
}).unknown(true);

export const UpdateOrganizationOrderSchema = Joi.object({
  newStatus: Joi.string().valid(...Object.values(OrganizationOrderStatus)).optional(),
});
