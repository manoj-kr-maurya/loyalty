// src/organizationOrders/dto/create-order.dto.ts
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
  IsDate,
} from 'class-validator';
// src/organizationOrders/dto/update-order.dto.ts
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CustomerOrganizationOrderStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
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
  @ApiProperty({ example: 100, description: 'The amount of cash being burned' })
  @IsNumber()
  amount!: number;
}

export class FetchCustomerOrdersForOrganizationQueryParams extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: String,
    enum: CustomerOrganizationOrderStatus,
    description: 'Filter orders by their current status',
  })
  @IsOptional()
  @IsEnum(CustomerOrganizationOrderStatus)
  status?: CustomerOrganizationOrderStatus;

  @ApiPropertyOptional({
    type: String,
    description: 'Shop ID to filter orders',
  })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiPropertyOptional({
    type: Date,
    description: 'Start date for filtering orders',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({
    type: Date,
    description: 'End date for filtering orders',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;
}

export class FetchCustomerOrdersForCustomerQueryParams extends PaginationQueryDto {}

export class BurningCoinAmountDetailsDto {
  @ApiProperty({ example: 'INR', description: 'Currency code of the coin' })
  @IsString()
  currencyCode!: string;

  @ApiProperty({ example: 50, description: 'The amount of coins being burned' })
  @IsNumber()
  amount!: number;
}

export class CustomerBurningAmountDetailDto {
  @ApiProperty({
    type: BurningCashAmountDetailsDto,
    description: 'Details about cash being burned',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BurningCashAmountDetailsDto)
  cash?: BurningCashAmountDetailsDto;

  @ApiProperty({
    type: [BurningCoinAmountDetailsDto], // Updated to be an array
    description: 'Details about coins being burned',
    required: false,
  })
  @IsOptional()
  @ValidateNested({ each: true }) // Validate each element of the array
  @Type(() => BurningCoinAmountDetailsDto)
  coin?: BurningCoinAmountDetailsDto[]; // Updated to be an array

  @ApiProperty({ example: 150, description: 'Total amount being burned' })
  @IsNumber()
  totalAmount!: number;
}

export class UpdateCustomerOrganizationOrderDto {
  @ApiProperty({
    example: CustomerOrganizationOrderStatus.REFUNDED,
    description: 'Organization id where the customer is paying',
    required: true,
    enum: CustomerOrganizationOrderStatus,
    type: String,
  })
  @IsEnum(CustomerOrganizationOrderStatus)
  status!: CustomerOrganizationOrderStatus;

  @ApiProperty({
    example: '8y7524380572308rhf232',
    description: 'order to update',
    required: true,
  })
  @IsString()
  orderId!: string;
}

export class GetCustomerOrganizationOrdersParams {
  @ApiProperty({
    example: '8y7524380572308rhf232',
    description: 'Organization id where the customer is paying',
    required: true,
  })
  @IsOptional()
  @IsString()
  organizationId!: string;
}

export class CreateCustomerOrganizationOrderDto {
  @ApiProperty({
    example: '8y7524380572308rhf232',
    description: 'Organization id where the customer is paying',
    required: true,
  })
  @IsString()
  organizationId!: string;

  @ApiProperty({
    example: {},
    description: 'Details about the burning amount (cash/coin)',
    required: true,
  })
  @ValidateNested()
  @Type(() => CustomerBurningAmountDetailDto)
  burningAmountDetails!: CustomerBurningAmountDetailDto;

  @ApiProperty({
    example: {},
    description:
      'Additional details as JSON, structure depends on the orderType',
    required: false,
  })
  @IsOptional()
  details?: any; // Use a union type or more specific types as needed for different detail structures
}

export class UpdateOrderDto extends PartialType(
  CreateCustomerOrganizationOrderDto,
) {}
