import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrganizationApiKeyGuard } from 'src/modules/auth/guards/organization-api-key.guard';
import { ScopesGuard } from 'src/modules/auth/guards/scopes.guard';
import { RequireScopes } from 'src/modules/auth/decorators/require-scopes.decorator';
import { ValueExchangeEngineService } from './value-exchange-engine.service';

@ApiTags('engines-value-exchange')
@ApiSecurity('x-api-key')
@UseGuards(OrganizationApiKeyGuard, ScopesGuard)
@Controller('engines/value-exchange')
export class ValueExchangeEngineController {
  constructor(private readonly valueExchange: ValueExchangeEngineService) {}

  // ─── Agreement CRUD ───────────────────────────────────

  @Post('agreements')
  @RequireScopes('exchange:write')
  @HttpCode(HttpStatus.CREATED)
  async createAgreement(@Body() body: {
    sourceEntityId: string;
    targetEntityId: string;
    name: string;
    sourceCurrency: string;
    targetCurrency: string;
    conversionRatio: number;
    minAmount?: number;
    maxAmount?: number;
    dailyCap?: number;
    monthlyCap?: number;
    isActive?: boolean;
    trustModel?: string;
    settlementModel?: string;
    breakageOwner?: string;
    effectiveFrom?: string;
    effectiveUntil?: string;
  }) {
    return this.valueExchange.createAgreement({
      ...body,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
      effectiveUntil: body.effectiveUntil ? new Date(body.effectiveUntil) : undefined,
    });
  }

  @Get('agreements/:sourceEntityId')
  @RequireScopes('exchange:read')
  async getAgreements(@Param('sourceEntityId') sourceEntityId: string) {
    return this.valueExchange.getAgreements(sourceEntityId);
  }

  // ─── Quote ────────────────────────────────────────────

  @Post('quote')
  @RequireScopes('exchange:read')
  @HttpCode(HttpStatus.OK)
  async getQuote(@Body() body: {
    agreementId: string;
    sourceEntityId: string;
    sourceCustomerId: string;
    sourceAmount: number;
  }) {
    return this.valueExchange.getQuote(body);
  }

  // ─── Execute ──────────────────────────────────────────

  @Post('execute')
  @RequireScopes('exchange:write')
  @HttpCode(HttpStatus.OK)
  async execute(@Body() body: {
    quoteId: string;
    sourceEntityId: string;
    sourceCustomerId: string;
  }) {
    return this.valueExchange.execute(body);
  }

  // ─── Reverse ──────────────────────────────────────────

  @Post('reverse')
  @RequireScopes('exchange:write')
  @HttpCode(HttpStatus.OK)
  async reverse(@Body() body: {
    orderId: string;
    sourceEntityId: string;
    reason?: string;
  }) {
    return this.valueExchange.reverse(body);
  }

  // ─── History ──────────────────────────────────────────

  @Get('orders/:sourceCustomerId/:sourceEntityId')
  @RequireScopes('exchange:read')
  async getOrderHistory(
    @Param('sourceCustomerId') sourceCustomerId: string,
    @Param('sourceEntityId') sourceEntityId: string,
  ) {
    return this.valueExchange.getOrderHistory(sourceCustomerId, sourceEntityId);
  }
}