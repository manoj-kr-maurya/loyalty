import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class TierDefinitionDto {
  @ApiProperty({ example: 'Gold' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  level: number;

  @ApiProperty({ example: 1000, minimum: 0 })
  @IsInt()
  @Min(0)
  minPoints: number;

  @ApiPropertyOptional({ example: 4999 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxPoints?: number;

  @ApiProperty({ example: 1.5 })
  @IsNumber()
  @Min(0)
  multiplier: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  benefits?: Record<string, any>;

  @ApiPropertyOptional({ example: '#FFD700' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/gold.png' })
  @IsOptional()
  @IsString()
  iconUrl?: string;
}

export class UpsertTiersDto {
  @ApiProperty({ example: 'c8f1e2a0-...' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ type: [TierDefinitionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TierDefinitionDto)
  tiers: TierDefinitionDto[];
}

export class EarnPointsDto {
  @ApiProperty({ example: '1f2e3d4c-...' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: '9a8b7c6d-...' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 2500, description: 'Base transaction amount' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'PTS' })
  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @ApiPropertyOptional({ example: 'ORDER-12345' })
  @IsOptional()
  @IsString()
  orderRef?: string;

  @ApiPropertyOptional({
    example: '2027-01-01T00:00:00.000Z',
    description: 'Expiry date assigned to the earned points',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description:
      'Idempotency key. The Idempotency-Key header takes precedence when both are supplied.',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class BurnPointsDto {
  @ApiProperty({ example: '1f2e3d4c-...' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: '9a8b7c6d-...' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @IsPositive()
  points: number;

  @ApiProperty({ example: 'PTS' })
  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @ApiPropertyOptional({ example: 'ORDER-12345' })
  @IsOptional()
  @IsString()
  orderRef?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description:
      'Idempotency key. The Idempotency-Key header takes precedence when both are supplied.',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class ExpirePointsDto {
  @ApiProperty({ example: '9a8b7c6d-...' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'PTS' })
  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z' })
  @IsDateString()
  expiryDate: string;
}

export class LoyaltyStatementDto {
  @ApiProperty({ example: '1f2e3d4c-...' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: '9a8b7c6d-...' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z' })
  @IsDateString()
  periodEnd: string;
}

export class EstimatePointsDto {
  @ApiProperty({ example: '1f2e3d4c-...' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: '9a8b7c6d-...' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 2500, description: 'Base transaction amount' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'PTS' })
  @IsOptional()
  @IsString()
  currencyCode?: string;
}
