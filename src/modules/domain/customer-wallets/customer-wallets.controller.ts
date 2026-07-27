import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { CallStatuses } from 'src/common/enums/status-codes';

import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { CustomerWalletService } from './customer-wallets.service';
import { VerifyJWTAndFetchPayload } from 'src/interceptors/auth/verify-jwt-and-fetch-payload';
import { RequestWithJWTTokenPayloadAndToken } from '../auth/DTO/jwt.dto';
import { CustomerWalletResponseCodes } from './enums/responseCodes';

@ApiTags('customer-wallets')
@Controller('customer-wallets')
export class CustomerWalletController {
  constructor(private readonly service: CustomerWalletService) {}

  @Get('/fetch-customer-wallets')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async fetchCustomerWallets(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Query(new ValidationPipe({ transform: true })) query: PaginationQueryDto,
  ) {
    const { wallets, metadata } = await this.service.fetchCustomerWallets(
      request.tokenPayload.sub,
      query,
    );

    return {
      status: CallStatuses.Success,
      data: wallets,
      metadata,
    };
  }

  @Get('/fetch-currency-wallet/:id')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async fetchCurrencyWallet(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true })) query: PaginationQueryDto,
  ) {
    const { pockets, metadata } = await this.service.fetchCurrencyWalletPockets(
      request.tokenPayload.sub,
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
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async fetchBroadCustomerBalance(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
  ) {
    const data = await this.service.fetchBroadCustomerBalance(
      request.tokenPayload.sub,
    );

    return {
      code: CustomerWalletResponseCodes.Broad_Customer_Balance_Fetched,
      status: CallStatuses.Success,
      data,
    };
  }
}
