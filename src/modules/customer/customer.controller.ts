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
import { OrganizationApiKeyGuard } from 'src/modules/auth/guards/organization-api-key.guard';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';
import { CurrentAuth } from 'src/modules/auth/decorators/current-auth.decorator';
import { OrganizationAuthContext } from 'src/modules/auth/api-key.service';
import { resolveOrganizationId } from 'src/modules/auth/resolve-organization-id';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

function withoutToken<T>(entity: T): T {
  if (!entity || typeof entity !== 'object') return entity;
  const { token: _token, ...safe } = entity as Record<string, unknown>;
  return safe as T;
}

@ApiTags('Customer')
@ApiSecurity('x-api-key')
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get(`/`)
  @UseGuards(OrganizationApiKeyGuard)
  async getCustomer(
    @Query('customerId') customerId: string,
    @Query('organizationId') organizationId: string,
    @Query('balances') balances: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    if (!customerId) {
      throw new CommonException('customerId is required', StatusCodes.BAD_REQUEST);
    }

    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    const data = await this.customerService.getCustomerForOrganization(
      customerId,
      effectiveOrganizationId,
      balances === 'true',
    );

    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Found,
      data:
        data && 'customer' in data
          ? { ...data, customer: withoutToken(data.customer) }
          : withoutToken(data),
    };
  }

  @Get(`/:customerId`)
  @UseGuards(OrganizationApiKeyGuard)
  async getCustomerWithId(
    @Param('customerId') customerId: string,
    @Query('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    const customer = await this.customerService.getCustomerByIdForOrganization(
      customerId,
      effectiveOrganizationId,
    );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Found,
      data: withoutToken(customer),
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
  @UseGuards(OrganizationApiKeyGuard)
  @UsePipes(new JoiValidationPipe(LogoutCustomerSchema))
  async logoutCustomer(
    @Body('customerId') customerId: string,
    @Query('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    return await this.customerService.logoutCustomerForOrganization(
      customerId,
      effectiveOrganizationId,
    );
  }

  @Post('/update')
  @UseGuards(OrganizationApiKeyGuard)
  @UsePipes(new JoiValidationPipe(UpdateCustomerSchema))
  async updateCustomer(
    @Body() form: { customerId: string; name?: string; base64Logo?: string },
    @Query('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const { customerId, ...data } = form;
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    const customer =
      await this.customerService.updateCustomerForOrganization(
        customerId,
        effectiveOrganizationId,
        data,
      );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Updated,
      data: withoutToken(customer),
    };
  }

  @Get('/leader-board/top-customers')
  @UseGuards(OrganizationApiKeyGuard)
  async getTopCustomersForLeaderBoard(
    @Query('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    const leaderBoardEntries =
      await this.customerService.getTopCustomersForLeaderBoard(
        48,
        effectiveOrganizationId,
      );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Leader_Board_Customers_Fetched,
      data: leaderBoardEntries,
    };
  }
}
