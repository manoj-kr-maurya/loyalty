import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CallStatuses } from 'src/common/enums/status-codes';

import { ApiTags, ApiResponse, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from 'src/common/dto/pagination.dto';
import {
  CustomerOrderFiltersDto,
  CustomerResponseDto,
  OrganizationResponseDto,
} from 'src/modules/organization/DTO/organization-response.dto';
import { InviteAdminForm } from './DTO/admin.dto';
import { AdminResponseCodes } from './enums/responseCodes';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';

@ApiTags('Admin')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('/fetch-all-organizations')
  @ApiResponse({
    status: 200,
    description: 'Returns paginated organizations list',
    type: OrganizationResponseDto,
    isArray: true,
  })
  async fetchAllOrganizations(
    @Query(new ValidationPipe({ transform: true })) query: PaginationQueryDto,
  ): Promise<PaginatedResponse<OrganizationResponseDto>> {
    const { organizations, metadata } =
      await this.adminService.fetchAllOrganizations(query);

    return {
      status: CallStatuses.Success,
      data: organizations,
      metadata,
    };
  }

  @Get('/fetch-all-customers')
  @ApiResponse({
    status: 200,
    description: 'Returns paginated organizations list',
    type: CustomerResponseDto,
    isArray: true,
  })
  async fetchAllCustomers(
    @Query(new ValidationPipe({ transform: true })) query: PaginationQueryDto,
  ): Promise<PaginatedResponse<CustomerResponseDto>> {
    const { customers, metadata } = await this.adminService.fetchAllCustomers(
      query,
    );

    return {
      status: CallStatuses.Success,
      data: customers,
      metadata,
    };
  }

  @Get('/fetch-organization/:id')
  async fetchOrganizationById(@Param('id') id: string) {
    const organization = await this.adminService.fetchOrganizationById(id);
    return {
      status: CallStatuses.Success,
      data: organization,
    };
  }

  @Get('/fetch-customer/:id')
  async fetchCustomerById(@Param('id') id: string) {
    const customer = await this.adminService.fetchCustomerById(id);
    return {
      status: CallStatuses.Success,
      data: customer,
    };
  }

  @Get('/fetch-customer-wallets/:id')
  async fetchCustomerWallets(
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true })) query: PaginationQueryDto,
  ) {
    const { wallets, metadata } = await this.adminService.fetchCustomerWallets(
      id,
      query,
    );

    return {
      status: CallStatuses.Success,
      data: wallets,
      metadata,
    };
  }

  @Get('/fetch-customer-orders/:id')
  async fetchCustomerOrders(
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true })) query: PaginationQueryDto,
  ) {
    const { orders, metadata } = await this.adminService.fetchCustomerOrders(
      id,
      query,
    );

    return {
      status: CallStatuses.Success,
      data: orders,
      metadata,
    };
  }

  @Get('/fetch-organization-campaigns/:id')
  async fetchOrganizationCampaigns(
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true })) query: PaginationQueryDto,
  ) {
    const { campaigns, metadata } =
      await this.adminService.fetchOrganizationCampaigns(id, query);

    return {
      status: CallStatuses.Success,
      data: campaigns,
      metadata,
    };
  }

  @Get('/fetch-organization-currencies/:id')
  async fetchOrganizationCurrencies(
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true })) query: PaginationQueryDto,
  ) {
    const { currencies, metadata } =
      await this.adminService.fetchOrganizationCurrencies(id, query);

    return {
      status: CallStatuses.Success,
      data: currencies,
      metadata,
    };
  }

  @Get('/fetch-organization-customer-orders/:id')
  async fetchOrganizationCustomerOrders(
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true }))
    query: PaginationQueryDto & CustomerOrderFiltersDto,
  ) {
    const { orders, metadata } =
      await this.adminService.fetchOrganizationCustomerOrders(id, query);

    return {
      status: CallStatuses.Success,
      data: orders,
      metadata,
    };
  }

  @Post('/invite-org-admin')
  @ApiOperation({ summary: 'Invite an admin' })
  @ApiResponse({ status: 200, description: 'Admin invited successfully.' })
  async inviteShop(@Body() form: InviteAdminForm) {
    const data = await this.adminService.inviteAdmin(form);
    return {
      status: CallStatuses.Success,
      code: AdminResponseCodes.Invited_Admin,
      data,
    };
  }
}
