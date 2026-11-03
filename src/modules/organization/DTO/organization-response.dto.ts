import {
  Customer,
  CustomerOrganizationOrderStatus,
  Organization,
} from '@prisma/client';
import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';

export class OrganizationResponseDto implements Partial<Organization> {
  id: string;
  name: string;
  phoneNumber: string;
  countryCode: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  address?: string;
}

export class CustomerResponseDto implements Partial<Customer> {
  id: string;
  name: string;
  phoneNumber: string;
  countryCode: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  address?: string;
}

export class CustomerOrderFiltersDto {
  @IsOptional()
  @IsEnum(CustomerOrganizationOrderStatus)
  status?: CustomerOrganizationOrderStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
