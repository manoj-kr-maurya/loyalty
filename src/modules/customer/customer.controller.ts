import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Customer } from '@prisma/client';
import { CallStatuses } from 'src/common/enums/status-codes';
import {
  OtpPhoneFindOrCreateSchema,
  OtpValidateOtpSchema,
  UpdateCustomerSchema,
  LogoutCustomerSchema,
} from './DTO/customer.dto';
import { CustomerService } from './customer.service';
import { CustomerResponseCodes } from './enums/responseCodes';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';

@ApiTags('Customer')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get(`/`)
  async getCustomer(
    @Query('customerId') customerId: string,
    @Param() balances: boolean,
  ) {
    const data =
      await this.customerService.someFunctionThatMyGetCustomerEndPointWillCall(
        customerId,
        balances,
      );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Found,
      data,
    };
  }

  @Get(`/:customerId`)
  async getCustomerWithId(@Param('customerId') customerId: string) {
    const customer = await this.customerService.getCustomerById(customerId);
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Found,
      data: customer,
    };
  }

  @Post('/otp/phone')
  @UsePipes(new JoiValidationPipe(OtpPhoneFindOrCreateSchema))
  async findOrCreateCustomersAndProceedOTPAuthentication(
    @Body() form: { countryCode: string; phoneNumber: string; name?: string },
  ): Promise<{
    status: CallStatuses;
    code: CustomerResponseCodes;
    data: string;
  }> {
    const customerId =
      await this.customerService.findOrCreateCustomersAndProceedPhoneAuthentication(
        form as any,
      );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Sent_Otp,
      data: customerId,
    };
  }

  @Post('/otp/validate')
  @UsePipes(new JoiValidationPipe(OtpValidateOtpSchema))
  async validateOtpAndGenerateToken(
    @Body() form: { id?: string; otp: string },
  ): Promise<{
    data: { token: string; customer: Customer };
    status: CallStatuses;
    message: string;
  }> {
    const { token, customer } =
      await this.customerService.validateOtpAndGenerateToken(form as any);
    return {
      data: { token, customer },
      status: CallStatuses.Success,
      message: 'Generated token successfully',
    };
  }

  @Post(`/logout`)
  @UsePipes(new JoiValidationPipe(LogoutCustomerSchema))
  async logoutCustomer(@Body('customerId') customerId: string) {
    return await this.customerService.logoutCustomer(customerId);
  }

  @Post('/update')
  @UsePipes(new JoiValidationPipe(UpdateCustomerSchema))
  async updateCustomer(
    @Body() form: { customerId: string; name?: string; base64Logo?: string },
  ) {
    const { customerId, ...data } = form;
    const customer =
      await this.customerService.someFunctionThatMyUpdateCustomerEndPointWillCall(
        customerId,
        data,
      );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Updated,
      data: customer,
    };
  }

  @Get('/leader-board/top-customers')
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
