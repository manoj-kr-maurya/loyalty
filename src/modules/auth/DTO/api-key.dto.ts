import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { API_KEY_SCOPES } from '../api-key.service';

export class CreateApiKeyDto {
  @ApiPropertyOptional({
    example: '9a8b7c6d-...',
    description:
      'Required when authenticating with the platform key; ignored for organization keys.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  organizationId?: string;

  @ApiPropertyOptional({ example: 'Production storefront' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    type: [String],
    enum: API_KEY_SCOPES,
    description: 'Defaults to every scope when omitted.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsIn(API_KEY_SCOPES, { each: true })
  scopes?: string[];

  @ApiPropertyOptional({
    example: '2027-01-01T00:00:00.000Z',
    description: 'Optional expiry. Keys never expire when omitted.',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ApiKeyOrganizationQueryDto {
  @ApiPropertyOptional({
    example: '9a8b7c6d-...',
    description:
      'Required when authenticating with the platform key; ignored for organization keys.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  organizationId?: string;
}
