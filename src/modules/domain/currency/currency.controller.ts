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
} from './DTO/currency.dto';
import { CurrencyResponseCodes } from './enums/responseCodes';
import { CallStatuses } from 'src/common/enums/status-codes';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';

@ApiTags('Currency')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Post(`/create`)
  @UsePipes(new JoiValidationPipe(CreateCurrencySchema))
  async createCurrency(
    @Body() form: { organizationId: string; currencyCode: string; name: string },
  ) {
    const currency = await this.currencyService.createCurrency(
      form.organizationId,
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
  ) {
    await this.currencyService.createOrganizationCurrencyBucket(
      form.organizationId,
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
  ) {
    const currencyBuckets =
      await this.currencyService.getOrganizationCurrencyBuckets(organizationId);
    return {
      status: 'success',
      code: CurrencyResponseCodes.Currency_Buckets_Fetched,
      data: currencyBuckets,
    };
  }

  @Post('/add-balance-to-organization-currency-bucket')
  @UsePipes(new JoiValidationPipe(AddBalanceSchema))
  async addBalanceToOrganizationCurrencyBucket(
    @Body() form: { organizationId: string; currencyCode: string; amount: number },
  ) {
    await this.currencyService.addBalanceToOrganizationCurrencyBucket(
      form.organizationId,
      form.currencyCode,
      form.amount,
    );
    return {
      status: CallStatuses.Success,
      code: CurrencyResponseCodes.Balance_Successfully_Updated,
    };
  }

  @Post('/update-organization-currency-bucket')
  @UsePipes(new JoiValidationPipe(UpdateBucketPropertiesSchema))
  async enableAutoTopupForOrganizationCurrencyBucket(
    @Body() form: { id: string; autoTopUpEnabled: boolean; autoTopUpThreshold?: number; autoTopUpAmount?: number },
  ) {
    const currencyBucket =
      await this.currencyService.updateOrganizationCurrencyBucketProperties(
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
  ) {
    const currencies = await this.currencyService.searchNonOrgCurrencies(
      substring,
      organizationId,
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
  ) {
    const data = await this.currencyService.getOrgDataForCustomer(
      form.organizationId,
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
  ) {
    const data = await this.currencyService.filterOrgCreatedCurrencies(
      form.organizationId,
      form.currencyCodes,
    );
    return {
      status: CallStatuses.Success,
      data,
    };
  }
}
