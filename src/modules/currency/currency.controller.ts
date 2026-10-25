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
import { CurrencyService } from './currency.service';
import {
  CreateCurrencySchema,
  CreateOrgCurrencyBucketSchema,
  AddBalanceSchema,
  UpdateBucketPropertiesSchema,
  FilterOrgCurrenciesSchema,
  ConfirmCurrencyPurchaseSchema,
} from './DTO/currency.dto';
import { CurrencyResponseCodes } from './enums/responseCodes';
import { CallStatuses } from 'src/common/enums/status-codes';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrganizationApiKeyGuard } from 'src/modules/auth/guards/organization-api-key.guard';
import { PlatformAdminGuard } from 'src/modules/auth/guards/platform-admin.guard';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';
import { CurrentAuth } from 'src/modules/auth/decorators/current-auth.decorator';
import { OrganizationAuthContext } from 'src/modules/auth/api-key.service';
import { resolveOrganizationId } from 'src/modules/auth/resolve-organization-id';

@ApiTags('Currency')
@ApiSecurity('x-api-key')
@UseGuards(OrganizationApiKeyGuard)
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Post(`/create`)
  @UsePipes(new JoiValidationPipe(CreateCurrencySchema))
  async createCurrency(
    @Body()
    form: { organizationId: string; currencyCode: string; name: string },
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, form.organizationId);
    const currency = await this.currencyService.createCurrency(
      organizationId,
      form,
    );
    return {
      status: 'success',
      code: CurrencyResponseCodes.Created_Currency,
      data: currency,
    };
  }

  @Post(`/create-organization-currency-bucket`)
  @UsePipes(new JoiValidationPipe(CreateOrgCurrencyBucketSchema))
  async createOrganizationCurrencyBucket(
    @Body() form: { organizationId: string; currencyCode: string },
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, form.organizationId);
    await this.currencyService.createOrganizationCurrencyBucket(
      organizationId,
      form,
    );
    return {
      status: 'success',
      code: CurrencyResponseCodes.Created_Currency_Bucket,
    };
  }

  @Get(`/get-organization-currency-buckets`)
  async getOrganizationCurrencyBuckets(
    @Query('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    const currencyBuckets =
      await this.currencyService.getOrganizationCurrencyBuckets(
        effectiveOrganizationId,
      );
    return {
      status: 'success',
      code: CurrencyResponseCodes.Currency_Buckets_Fetched,
      data: currencyBuckets,
    };
  }

  @Post('/add-balance-to-organization-currency-bucket')
  @UseGuards(PlatformAdminGuard)
  @UsePipes(new JoiValidationPipe(AddBalanceSchema))
  async addBalanceToOrganizationCurrencyBucket(
    @Body()
    form: {
      organizationId: string;
      currencyCode: string;
      amount: number;
      paymentReference: string;
      paymentAmount: number;
      paymentProvider?: string;
    },
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, form.organizationId);
    const data =
      await this.currencyService.addBalanceToOrganizationCurrencyBucket(
        organizationId,
        form.currencyCode,
        form.amount,
        form.paymentReference,
        form.paymentAmount,
        form.paymentProvider,
      );
    return {
      status: CallStatuses.Success,
      code: CurrencyResponseCodes.Balance_Successfully_Updated,
      data,
    };
  }

  @Post('/confirm-currency-purchase')
  @UseGuards(PlatformAdminGuard)
  @UsePipes(new JoiValidationPipe(ConfirmCurrencyPurchaseSchema))
  async confirmCurrencyPurchase(
    @Body()
    form: {
      orderId: string;
      paymentReference: string;
      paymentAmount: number;
      paymentProvider?: string;
    },
  ) {
    const data = await this.currencyService.confirmCurrencyPurchase(form);
    return {
      status: CallStatuses.Success,
      code: CurrencyResponseCodes.Balance_Successfully_Updated,
      data,
    };
  }

  @Post('/update-organization-currency-bucket')
  async enableAutoTopupForOrganizationCurrencyBucket(
    @Body(new JoiValidationPipe(UpdateBucketPropertiesSchema))
    form: {
      id: string;
      autoTopUpEnabled: boolean;
      autoTopUpThreshold?: number;
      autoTopUpAmount?: number;
    },
    @Query('organizationId') requestedOrganizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, requestedOrganizationId);
    const currencyBucket =
      await this.currencyService.updateOrganizationCurrencyBucketProperties(
        organizationId,
        form as any,
      );
    return {
      status: CallStatuses.Success,
      code: CurrencyResponseCodes.Currency_Bucket_Updated,
      data: currencyBucket,
    };
  }

  @Get('/search/non-organization/:substring')
  async searchCurrencies(
    @Param('substring') substring: string,
    @Query('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    const currencies = await this.currencyService.searchNonOrgCurrencies(
      substring,
      effectiveOrganizationId,
    );
    return {
      status: CallStatuses.Success,
      code: CurrencyResponseCodes.Currencies_Fetched,
      data: currencies,
    };
  }

  @Post(`/org-data-needed-by-customer`)
  async getOrganizationCurrencies(
    @Body() form: { organizationId: string; customerId?: string },
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, form.organizationId);
    const data = await this.currencyService.getOrgDataForCustomer(
      organizationId,
      form.customerId ?? '',
    );
    return {
      status: CallStatuses.Success,
      data,
    };
  }

  @Post(`/filter-organization-created-currencies`)
  @UsePipes(new JoiValidationPipe(FilterOrgCurrenciesSchema))
  async filterOrgCreatedCurrencies(
    @Body() form: { organizationId: string; currencyCodes: string[] },
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, form.organizationId);
    const data = await this.currencyService.filterOrgCreatedCurrencies(
      organizationId,
      form.currencyCodes,
    );
    return {
      status: CallStatuses.Success,
      data,
    };
  }
}
