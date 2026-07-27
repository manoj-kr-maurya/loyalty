import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { Customer } from '@prisma/client';
import { CallStatuses } from 'src/common/enums/status-codes';
import {
  GetCustomerParams,
  OtpPhoneFindOrCreateCustomerForm,
  OtpValidateOtpBodyForm,
  UpdateCustomerForm,
} from './DTO/customer.dto';
import { CustomerService } from './customer.service';
import { CustomerResponseCodes } from './enums/responseCodes';
import { ApiTags } from '@nestjs/swagger';
import {
  RequestWithJWTTokenPayloadAndToken,
  JwtTokenPayload,
} from '../auth/DTO/jwt.dto';
import { VerifyJWTAndFetchPayload } from 'src/interceptors/auth/verify-jwt-and-fetch-payload';
import { CacheResponseInterceptor } from 'src/interceptors/cache/cache-response.interceptor';

@ApiTags('Customer')
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get(`/`)
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async getCustomer(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Param() balances: boolean,
  ) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    const data =
      await this.customerService.someFunctionThatMyGetCustomerEndPointWillCall(
        jwtTokenPayload.sub,
        balances,
      );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Found,
      data,
    };
    // bug: DO NOT return full customer.
  }

  @Get(`/:customerId`)
  // @UseInterceptors(VerifyJWTAndFetchPayload)
  async getCustomerWithId(@Param() params: GetCustomerParams) {
    const customer = await this.customerService.getCustomerById(
      params.customerId,
    );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Found,
      data: customer,
    }; // bug: DO NOT return full customer.
  }

  @Post('/otp/phone')
  // @UseInterceptors(VerifyJWTAndFetchPayload)
  async findOrCreateCustomersAndProceedOTPAuthentication(
    @Body() form: OtpPhoneFindOrCreateCustomerForm,
    // @Req() request: RequestWithJWTTokenPayloadAndToken,
  ): Promise<{
    status: CallStatuses;
    code: CustomerResponseCodes;
    data: string;
  }> {
    // const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    const customerId =
      await this.customerService.findOrCreateCustomersAndProceedPhoneAuthentication(
        form,
        // jwtTokenPayload.sub,
      );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Sent_Otp,
      data: customerId,
    };
  }

  @Post('/otp/validate')
  // @UseInterceptors(VerifyJWTAndFetchPayload)
  async validateOtpAndGenerateToken(
    @Body() form: OtpValidateOtpBodyForm,
  ): Promise<{
    data: { token: string; customer: Customer };
    status: CallStatuses;
    message: string;
  }> {
    const { token, customer } =
      await this.customerService.validateOtpAndGenerateToken(form);
    return {
      data: { token, customer },
      status: CallStatuses.Success,
      message: 'Generated token successfully',
    };
  }

  @Post(`/logout`)
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async logoutCustomer(@Req() request: RequestWithJWTTokenPayloadAndToken) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    return await this.customerService.logoutCustomer(jwtTokenPayload.sub);
  }

  @Post('/update')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async updateOrganization(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Body() form: UpdateCustomerForm,
  ) {
    const customerId = request.tokenPayload.sub;
    const customer =
      await this.customerService.someFunctionThatMyUpdateCustomerEndPointWillCall(
        customerId,
        form,
      );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Updated,
      data: customer,
    };
  }

  @Get('/leader-board/top-customers')
  @UseInterceptors(
    VerifyJWTAndFetchPayload,
    CacheResponseInterceptor.register({
      ttl: 60, // 1 minute cache TTL
      keyPrefix: 'customer-leaderboard',
      includeQueryParams: true, // This will include any query params in the cache key
    }),
  )
  async getTopCustomersForLeaderBoard() {
    const leaderBoardEntries =
      await this.customerService.getTopCustomersForLeaderBoard();
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Leader_Board_Customers_Fetched,
      data: leaderBoardEntries,
    };
  }
}
