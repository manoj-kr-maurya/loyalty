import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { CallStatuses } from 'src/common/enums/status-codes';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { CustomerWalletService } from './customer-wallets.service';
import { OrganizationApiKeyGuard } from 'src/modules/auth/guards/organization-api-key.guard';
import { CustomerWalletResponseCodes } from './enums/responseCodes';
import { CurrentAuth } from 'src/modules/auth/decorators/current-auth.decorator';
import { OrganizationAuthContext } from 'src/modules/auth/api-key.service';
import { resolveOrganizationId } from 'src/modules/auth/resolve-organization-id';
import { CustomerPrismaHelperService } from '../customer/customer-prisma-helper.service';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

@ApiTags('customer-wallets')
@ApiSecurity('x-api-key')
@UseGuards(OrganizationApiKeyGuard)
@Controller('customer-wallets')
export class CustomerWalletController {
  constructor(
    private readonly service: CustomerWalletService,
    private readonly customerAccess: CustomerPrismaHelperService,
  ) {}

  private async authorizeCustomer(
    customerId: string | undefined,
    organizationId: string | undefined,
    auth: OrganizationAuthContext,
  ) {
    if (!customerId) {
      throw new CommonException('customerId is required', StatusCodes.BAD_REQUEST);
    }
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    await this.customerAccess.assertCustomerBelongsToOrganization(
      customerId,
      effectiveOrganizationId,
    );
    return { customerId, organizationId: effectiveOrganizationId };
  }

  @Get('/fetch-customer-wallets')
  async fetchCustomerWallets(
    @Query('customerId') customerId: string,
    @Query('organizationId') organizationId: string,
    @Query(new ValidationPipe({ transform: true })) query: PaginationQueryDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const scoped = await this.authorizeCustomer(
      customerId,
      organizationId,
      auth,
    );
    const { wallets, metadata } = await this.service.fetchCustomerWallets(
      scoped.customerId,
      scoped.organizationId,
      query,
    );
    return {
      status: CallStatuses.Success,
      data: wallets,
      metadata,
    };
  }

  @Get('/fetch-currency-wallet/:id')
  async fetchCurrencyWallet(
    @Query('customerId') customerId: string,
    @Query('organizationId') organizationId: string,
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true })) query: PaginationQueryDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const scoped = await this.authorizeCustomer(
      customerId,
      organizationId,
      auth,
    );
    const { pockets, metadata } = await this.service.fetchCurrencyWalletPockets(
      scoped.customerId,
      scoped.organizationId,
      id,
      query,
    );
    return {
      status: CallStatuses.Success,
      data: pockets,
      metadata,
    };
  }

  @Get('/broad-customer-balance')
  async fetchBroadCustomerBalance(
    @Query('customerId') customerId: string,
    @Query('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const scoped = await this.authorizeCustomer(
      customerId,
      organizationId,
      auth,
    );
    const data = await this.service.fetchBroadCustomerBalance(
      scoped.customerId,
      scoped.organizationId,
    );
    return {
      code: CustomerWalletResponseCodes.Broad_Customer_Balance_Fetched,
      status: CallStatuses.Success,
      data,
    };
  }
}
