// src/organizationOrders/dto/create-order.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
// src/organizationOrders/dto/update-order.dto.ts
import { PartialType } from '@nestjs/swagger';
import { OrganizationOrderStatus, OrganizationOrderType } from '@prisma/client';
interface CurrencyPurchaseDetails {
  currencyCode: string;
}

// Modify the CreateOrderDto to include a generic details field
export class CreateOrderDto {
  @ApiProperty({
    example: 'CURRENCY_PURCHASE',
    enum: OrganizationOrderType,
    description: 'Type of the order',
  })
  @IsEnum(OrganizationOrderType)
  orderType!: OrganizationOrderType;

  @ApiPropertyOptional({
    example: 100,
    description: 'Amount for the order',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiProperty({
    example: {},
    description:
      'Additional details as JSON, structure depends on the orderType',
    required: true,
  })
  details!: CurrencyPurchaseDetails; // Use a union type for different detail structures
}

export class UpdateOrderDto {
  @ApiProperty({
    type: String,
    enum: OrganizationOrderStatus,
    example: OrganizationOrderStatus.CANCELLED,
    description: 'Amount for the order',
  })
  @IsEnum(OrganizationOrderStatus)
  newStatus?: OrganizationOrderStatus;
}
