import { ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 }) page?: number = 1;
  @ApiPropertyOptional({ default: 10 }) limit?: number = 10;
  @ApiPropertyOptional() search?: string;
}

export const PaginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
  search: Joi.string().optional(),
}).unknown(true);

export interface PaginatedResponse<T> {
  data: T[];
  metadata: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
  status: string;
}
