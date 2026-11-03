import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrganizationApiKeyGuard } from 'src/modules/auth/guards/organization-api-key.guard';
import { ScopesGuard } from 'src/modules/auth/guards/scopes.guard';
import { RequireScopes } from 'src/modules/auth/decorators/require-scopes.decorator';
import { FXEngineService } from './fx-engine.service';

@ApiTags('engines-fx')
@ApiSecurity('x-api-key')
@UseGuards(OrganizationApiKeyGuard, ScopesGuard)
@Controller('engines/fx')
export class FXEngineController {
  constructor(private readonly fxEngine: FXEngineService) {}

  @Post('convert')
  @RequireScopes('fx:write')
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
  @RequireScopes('fx:write')
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
  @RequireScopes('fx:read')
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
  @RequireScopes('fx:read')
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