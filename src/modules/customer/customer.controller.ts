import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
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
  UpdateMyProfileSchema,
  MyStatementQuerySchema,
  CustomerSessionSchema,
} from './DTO/customer.dto';
import { CustomerService } from './customer.service';
import { CustomerResponseCodes } from './enums/responseCodes';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrganizationApiKeyGuard } from 'src/modules/auth/guards/organization-api-key.guard';
import { CustomerSessionGuard } from 'src/modules/auth/guards/customer-session.guard';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';
import { CurrentAuth } from 'src/modules/auth/decorators/current-auth.decorator';
import { OrganizationAuthContext } from 'src/modules/auth/api-key.service';
import { resolveOrganizationId } from 'src/modules/auth/resolve-organization-id';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';
import { ConfigService } from '@nestjs/config';
import { envEnums } from 'src/config/enums';
import { redactSecrets } from 'src/common/utils/redact.util';

@ApiTags('Customer')
@ApiSecurity('x-api-key')
@Controller('customer')
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly configService: ConfigService,
  ) {}

  @Get(`/`)
  @UseGuards(OrganizationApiKeyGuard)
  async getCustomer(
    @Query('customerId') customerId: string,
    @Query('organizationId') organizationId: string,
    @Query('balances') balances: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    if (!customerId) {
      throw new CommonException(
        'customerId is required',
        StatusCodes.BAD_REQUEST,
      );
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
          ? { ...data, customer: redactSecrets(data.customer) }
          : redactSecrets(data),
    };
  }

  @Get('/me')
  @UseGuards(CustomerSessionGuard)
  async getMyProfile(
    @Req() req: { customerId: string; organizationId: string },
  ) {
    const customer = await this.customerService.getMyProfile(
      req.customerId,
      req.organizationId,
    );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Found,
      data: redactSecrets(customer),
    };
  }

  @Post('/me')
  @UseGuards(CustomerSessionGuard)
  @UsePipes(new JoiValidationPipe(UpdateMyProfileSchema))
  async updateMyProfile(
    @Body() body: { name?: string },
    @Req() req: { customerId: string; organizationId: string },
  ) {
    const customer = await this.customerService.updateMyProfile(
      req.customerId,
      req.organizationId,
      body,
    );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Updated,
      data: redactSecrets(customer),
    };
  }

  @Get('/me/wallets')
  @UseGuards(CustomerSessionGuard)
  async getMyWallets(
    @Req() req: { customerId: string; organizationId: string },
  ) {
    return {
      status: CallStatuses.Success,
      data: await this.customerService.getMyWallets(
        req.customerId,
        req.organizationId,
      ),
    };
  }

  @Get('/me/orders')
  @UseGuards(CustomerSessionGuard)
  async getMyOrders(
    @Req() req: { customerId: string; organizationId: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return {
      status: CallStatuses.Success,
      data: await this.customerService.getMyOrders(
        req.customerId,
        req.organizationId,
        Number(page) || 1,
        Number(limit) || 20,
      ),
    };
  }

  @Get('/me/statement')
  @UseGuards(CustomerSessionGuard)
  async getMyStatement(
    @Req() req: { customerId: string; organizationId: string },
    @Query(new JoiValidationPipe(MyStatementQuerySchema, 'query'))
    query: { currencyCode: string },
  ) {
    return {
      status: CallStatuses.Success,
      data: await this.customerService.getMyStatement(
        req.customerId,
        req.organizationId,
        query.currencyCode,
      ),
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
      data: redactSecrets(customer),
    };
  }

  /**
   * Exchanges a tenant's assertion of a shopper identity for a short lived,
   * tenant scoped session token. The tenant authenticates the shopper in its
   * own product; this engine never asks a shopper for an OTP.
   */
  @Post('/session')
  @UseGuards(OrganizationApiKeyGuard)
  @UsePipes(new JoiValidationPipe(CustomerSessionSchema))
  async createCustomerSession(
    @Body()
    form: {
      externalId?: string;
      phoneNumber?: string;
      countryCode?: string;
      name?: string;
    },
    @Query('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    const session = await this.customerService.createCustomerSession(
      effectiveOrganizationId,
      form,
    );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Found,
      data: session,
    };
  }

  @Post('/otp/phone')
  @UsePipes(new JoiValidationPipe(OtpPhoneFindOrCreateSchema))
  async findOrCreateCustomersAndProceedOTPAuthentication(
    @Body()
    form: {
      countryCode: string;
      phoneNumber: string;
      name?: string;
      organizationId?: string;
    },
  ): Promise<{
    status: CallStatuses;
    code: CustomerResponseCodes;
    data: string;
  }> {
    this.assertShopperOtpIsEnabled();

    if (!form.organizationId) {
      throw new CommonException(
        'organizationId is required',
        StatusCodes.BAD_REQUEST,
      );
    }

    const customerId =
      await this.customerService.findOrCreateCustomersAndProceedPhoneAuthentication(
        form as any,
        form.organizationId,
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
    this.assertShopperOtpIsEnabled();

    const { token, customer } =
      await this.customerService.validateOtpAndGenerateToken(form as any);
    return {
      data: { token, customer },
      status: CallStatuses.Success,
      message: 'Generated token successfully',
    };
  }

  private assertShopperOtpIsEnabled() {
    const isEnabled = this.configService.get<boolean>(
      envEnums.CUSTOMER_OTP_ENABLED,
    );
    if (!isEnabled) {
      throw new CommonException(
        'Shopper OTP authentication is disabled. Use POST /customer/session to obtain a customer session.',
        StatusCodes.GONE,
      );
    }
  }

  @Post(`/logout`)
  @UseGuards(OrganizationApiKeyGuard)
  async logoutCustomer(
    @Body(new JoiValidationPipe(LogoutCustomerSchema))
    form: { customerId: string },
    @Query('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    return await this.customerService.logoutCustomerForOrganization(
      form.customerId,
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
    const customer = await this.customerService.updateCustomerForOrganization(
      customerId,
      effectiveOrganizationId,
      data,
    );
    return {
      status: CallStatuses.Success,
      code: CustomerResponseCodes.Customer_Updated,
      data: redactSecrets(customer),
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
