import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoyaltyWebhookDeliveryStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export const LOYALTY_WEBHOOK_EVENTS = [
  'points.earned',
  'points.burned',
  'points.expired',
  'points.transferred',
  'tier.upgraded',
] as const;

export class CreateWebhookDto {
  @ApiProperty({ example: '9a8b7c6d-...' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'https://example.com/hooks/loyalty' })
  @IsUrl({
    require_protocol: true,
    require_tld: false,
    protocols: ['http', 'https'],
  })
  url: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['points.earned', 'tier.upgraded'],
    description: 'Empty array subscribes to every event',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional({ example: 'Production CRM sync' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'HMAC signing secret. Generated automatically when omitted. Store it securely; it is only returned once.',
  })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class OrganizationQueryDto {
  @ApiProperty({ example: '9a8b7c6d-...' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;
}

export class WebhookEndpointQueryDto {
  @ApiProperty({ example: '9a8b7c6d-...' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean = false;
}

export class WebhookDeliveryQueryDto {
  @ApiProperty({ example: '9a8b7c6d-...' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiPropertyOptional({ example: '3f2e1d4c-...' })
  @IsOptional()
  @IsString()
  endpointId?: string;

  @ApiPropertyOptional({ enum: LoyaltyWebhookDeliveryStatus })
  @IsOptional()
  @IsEnum(LoyaltyWebhookDeliveryStatus)
  status?: LoyaltyWebhookDeliveryStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
