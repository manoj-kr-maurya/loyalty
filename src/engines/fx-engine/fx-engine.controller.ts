import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FXEngineService } from './fx-engine.service';

@Controller('engines/fx')
export class FXEngineController {
  constructor(private readonly fxEngine: FXEngineService) {}

  @Post('convert')
  @HttpCode(HttpStatus.OK)
  async convert(@Body() body: {
    fromCurrency: string;
    toCurrency: string;
    amount: number;
    tenantId?: string;
    lockRate?: boolean;
    lockDurationMinutes?: number;
  }) {
    return this.fxEngine.convert(body);
  }

  @Post('lock-rate')
  @HttpCode(HttpStatus.OK)
  async lockRate(@Body() body: {
    currencyCode: string;
    physicalCurrencyCode: string;
    rate: number;
    lockedBy: string;
    lockDurationMinutes: number;
  }) {
    return this.fxEngine.lockRate(body);
  }

  @Get('historical-rates/:currencyCode')
  async getHistoricalRates(
    @Param('currencyCode') currencyCode: string,
    @Query('physicalCurrencyCode') physicalCurrencyCode: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.fxEngine.getHistoricalRates({
      currencyCode,
      physicalCurrencyCode,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }

  @Get('reconciliation/:tenantId')
  async getReconciliationReport(
    @Param('tenantId') tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.fxEngine.getReconciliationReport({
      tenantId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }
}