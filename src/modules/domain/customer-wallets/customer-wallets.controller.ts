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
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { CustomerWalletResponseCodes } from './enums/responseCodes';

@ApiTags('customer-wallets')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('customer-wallets')
export class CustomerWalletController {
  constructor(private readonly service: CustomerWalletService) {}

  @Get('/fetch-customer-wallets')
  async fetchCustomerWallets(
    @Query('organizationId') organizationId: string,
    @Query(new ValidationPipe({ transform: true })) query: PaginationQueryDto,
  ) {
    const { wallets, metadata } = await this.service.fetchCustomerWallets(
      organizationId,
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
    @Query('organizationId') organizationId: string,
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true })) query: PaginationQueryDto,
  ) {
    const { pockets, metadata } = await this.service.fetchCurrencyWalletPockets(
      organizationId,
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
    @Query('organizationId') organizationId: string,
  ) {
    const data = await this.service.fetchBroadCustomerBalance(organizationId);
    return {
      code: CustomerWalletResponseCodes.Broad_Customer_Balance_Fetched,
      status: CallStatuses.Success,
      data,
    };
  }
}
