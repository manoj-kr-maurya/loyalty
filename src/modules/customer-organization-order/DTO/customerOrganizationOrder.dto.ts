import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerOrganizationOrderStatus } from '@prisma/client';
import * as Joi from 'joi';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

export interface CustomerInfo {
  customerId: string;
}

export interface OrderInfo {
  orderId: string;
  earning: {
    coin: {
      currencyCode: string;
      amount: number;
      earningExpiresIn: number;
    }[];
    totalAmount: number;
  };
}

export class BurningCashAmountDetailsDto {
  @ApiProperty({ example: 100 }) amount!: number;
}

export class FetchCustomerOrdersForOrganizationQueryParams extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CustomerOrganizationOrderStatus })
  status?: CustomerOrganizationOrderStatus;
  @ApiPropertyOptional({ type: String }) shopId?: string;
  @ApiPropertyOptional({ type: Date }) startDate?: Date;
  @ApiPropertyOptional({ type: Date }) endDate?: Date;
}

export class FetchCustomerOrdersForCustomerQueryParams extends PaginationQueryDto {}

export class BurningCoinAmountDetailsDto {
  @ApiProperty({ example: 'INR' }) currencyCode!: string;
  @ApiProperty({ example: 50 }) amount!: number;
}

export class CustomerBurningAmountDetailDto {
  @ApiPropertyOptional({ type: BurningCashAmountDetailsDto })
  cash?: BurningCashAmountDetailsDto;
  @ApiPropertyOptional({ type: [BurningCoinAmountDetailsDto] })
  coin?: BurningCoinAmountDetailsDto[];
  @ApiProperty({ example: 150 }) totalAmount!: number;
}

export class UpdateCustomerOrganizationOrderDto {
  @ApiProperty({ enum: CustomerOrganizationOrderStatus })
  status!: CustomerOrganizationOrderStatus;
  @ApiProperty({ type: String }) orderId!: string;
}

export class GetCustomerOrganizationOrdersParams {
  @ApiPropertyOptional({ type: String }) organizationId!: string;
}

export class CreateCustomerOrganizationOrderDto {
  @ApiProperty({ type: String }) organizationId!: string;
  @ApiProperty({ type: CustomerBurningAmountDetailDto })
  burningAmountDetails!: CustomerBurningAmountDetailDto;
  @ApiPropertyOptional() details?: any;
  @ApiPropertyOptional({ type: String }) idempotencyKey?: string;
}

export const BurningCashSchema = Joi.object({
  amount: Joi.number().positive().required(),
});

export const BurningCoinSchema = Joi.object({
  currencyCode: Joi.string().required(),
  amount: Joi.number().positive().required(),
});

export const BurningAmountDetailSchema = Joi.object({
  cash: BurningCashSchema.optional(),
  coin: Joi.array().items(BurningCoinSchema).optional(),
  totalAmount: Joi.number().positive().required(),
});

export const CreateOrderSchema = Joi.object({
  customerId: Joi.string().required(),
  organizationId: Joi.string().optional(),
  burningAmountDetails: BurningAmountDetailSchema.required(),
  details: Joi.any().optional(),
  idempotencyKey: Joi.string().optional(),
}).unknown(true);

export const UpdateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(CustomerOrganizationOrderStatus))
    .required(),
  orderId: Joi.string().required(),
  organizationId: Joi.string().optional(),
});
