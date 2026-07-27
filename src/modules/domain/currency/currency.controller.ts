import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { CurrencyService } from './currency.service';
import {
  AddBalanceToCurrencyBucketForm,
  CreateCurrencyForm,
  CreateOrgnizationCurrencyBucketForm,
  FilterOrgCreatedCurrenciesForm,
  GetOrgCurrenciesForm,
  UpdateCurrencyBucketPropertiesForm,
} from './DTO/currency.dto';
import { CurrencyResponseCodes } from './enums/responseCodes';
import { CallStatuses } from 'src/common/enums/status-codes';
import { ApiTags } from '@nestjs/swagger';
import {
  RequestWithJWTTokenPayloadAndToken,
  JwtTokenPayload,
} from '../auth/DTO/jwt.dto';
import { VerifyJWTAndFetchPayload } from 'src/interceptors/auth/verify-jwt-and-fetch-payload';
@ApiTags('Currency')
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}
  @Post(`/create`)
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async createCurrency(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Body() form: CreateCurrencyForm,
  ) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    const currency = await this.currencyService.createCurrency(
      jwtTokenPayload.sub,
      form,
    );

    return {
      status: 'success',
      code: CurrencyResponseCodes.Created_Currency,
      data: currency,
    };
  }

  @Post(`/create-organization-currency-bucket`)
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async createOrganizationCurrencyBucket(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Body() form: CreateOrgnizationCurrencyBucketForm,
  ) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    await this.currencyService.createOrganizationCurrencyBucket(
      jwtTokenPayload.sub,
      form,
    );
    return {
      status: 'success',
      code: CurrencyResponseCodes.Created_Currency_Bucket,
    };
  }

  @Get(`/get-organization-currency-buckets`)
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async getOrganizationCurrencyBuckets(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
  ) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    const currencyBuckets =
      await this.currencyService.getOrganizationCurrencyBuckets(
        jwtTokenPayload.sub,
      );
    return {
      status: 'success',
      code: CurrencyResponseCodes.Currency_Buckets_Fetched,
      data: currencyBuckets,
    };
  }

  @Post('/add-balance-to-organization-currency-bucket')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async addBalanceToOrganizationCurrencyBucket(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Body() form: AddBalanceToCurrencyBucketForm,
  ) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;

    await this.currencyService.addBalanceToOrganizationCurrencyBucket(
      jwtTokenPayload.sub, // Assuming sub contains the organization ID
      form.currencyCode,
      form.amount,
    );
    return {
      status: CallStatuses.Success,
      code: CurrencyResponseCodes.Balance_Successfully_Updated,
    };
  }

  @Post('/update-organization-currency-bucket')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async enableAutoTopupForOrganizationCurrencyBucket(
    @Body() form: UpdateCurrencyBucketPropertiesForm,
  ) {
    const currencyBucket =
      await this.currencyService.updateOrganizationCurrencyBucketProperties(
        form,
      );
    return {
      status: CallStatuses.Success,
      code: CurrencyResponseCodes.Currency_Bucket_Updated,
      data: currencyBucket,
    };
  }

  @Get('/search/non-organization/:substring')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async searchCurrencies(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Param('substring') substring: string,
  ) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    const currencies = await this.currencyService.searchNonOrgCurrencies(
      substring,
      jwtTokenPayload.sub,
    );
    return {
      status: CallStatuses.Success,
      code: CurrencyResponseCodes.Currencies_Fetched,
      data: currencies,
    };
  }

  @Post(`/org-data-needed-by-customer`)
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async getOrganizationCurrencies(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Body() form: GetOrgCurrenciesForm,
  ) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;

    const data = await this.currencyService.getOrgDataForCustomer(
      form.organizationId,
      jwtTokenPayload.sub,
    );
    return {
      status: CallStatuses.Success,
      data,
    };
    // bug: DO NOT return full organization.
  }

  @Post(`/filter-organization-created-currencies`)
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async filterOrgCreatedCurrencies(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Body() form: FilterOrgCreatedCurrenciesForm,
  ) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    const data = await this.currencyService.filterOrgCreatedCurrencies(
      jwtTokenPayload.sub,
      form.currencyCodes,
    );
    return {
      status: CallStatuses.Success,
      data,
    };
    // bug: DO NOT return full organization.
  }
}
