import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ValueExchangeEngineService } from './value-exchange-engine.service';

@Controller('engines/value-exchange')
export class ValueExchangeEngineController {
  constructor(private readonly valueExchange: ValueExchangeEngineService) {}

  // ─── Agreement CRUD ───────────────────────────────────

  @Post('agreements')
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
  async getAgreements(@Param('sourceEntityId') sourceEntityId: string) {
    return this.valueExchange.getAgreements(sourceEntityId);
  }

  // ─── Quote ────────────────────────────────────────────

  @Post('quote')
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
  async getOrderHistory(
    @Param('sourceCustomerId') sourceCustomerId: string,
    @Param('sourceEntityId') sourceEntityId: string,
  ) {
    return this.valueExchange.getOrderHistory(sourceCustomerId, sourceEntityId);
  }
}