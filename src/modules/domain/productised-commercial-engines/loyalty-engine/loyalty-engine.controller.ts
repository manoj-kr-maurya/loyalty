import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LoyaltyEngineService } from './loyalty-engine.service';

@Controller('engines/loyalty')
export class LoyaltyEngineController {
  constructor(private readonly loyaltyEngine: LoyaltyEngineService) {}

  // ─── Tiers ────────────────────────────────────────────

  @Post('tiers')
  @HttpCode(HttpStatus.OK)
  async upsertTiers(@Body() body: {
    organizationId: string;
    tiers: Array<{
      name: string;
      level: number;
      minPoints: number;
      maxPoints?: number;
      multiplier: number;
      benefits?: Record<string, any>;
      color?: string;
      iconUrl?: string;
    }>;
  }) {
    return this.loyaltyEngine.upsertTiers(body);
  }

  @Get('tiers/:organizationId')
  async getTiers(@Param('organizationId') organizationId: string) {
    return this.loyaltyEngine.getTiers(organizationId);
  }

  // ─── Earn / Burn ──────────────────────────────────────

  @Post('earn')
  @HttpCode(HttpStatus.OK)
  async earnPoints(@Body() body: {
    customerId: string;
    organizationId: string;
    amount: number;
    currencyCode: string;
    orderRef?: string;
    metadata?: Record<string, any>;
  }) {
    return this.loyaltyEngine.earnPoints(body);
  }

  @Post('burn')
  @HttpCode(HttpStatus.OK)
  async burnPoints(@Body() body: {
    customerId: string;
    organizationId: string;
    points: number;
    currencyCode: string;
    orderRef?: string;
    metadata?: Record<string, any>;
  }) {
    return this.loyaltyEngine.burnPoints(body);
  }

  // ─── Expiry ───────────────────────────────────────────

  @Post('expire')
  @HttpCode(HttpStatus.OK)
  async expirePoints(@Body() body: {
    organizationId: string;
    currencyCode: string;
    expiryDate: string;
  }) {
    return this.loyaltyEngine.expirePoints({
      ...body,
      expiryDate: new Date(body.expiryDate),
    });
  }

  // ─── Statement ────────────────────────────────────────

  @Post('statement')
  @HttpCode(HttpStatus.OK)
  async generateStatement(@Body() body: {
    customerId: string;
    organizationId: string;
    periodStart: string;
    periodEnd: string;
  }) {
    return this.loyaltyEngine.generateStatement({
      ...body,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    });
  }

  // ─── Tier Status ──────────────────────────────────────

  @Get('tier-status/:customerId/:organizationId')
  async getCustomerTier(
    @Param('customerId') customerId: string,
    @Param('organizationId') organizationId: string,
  ) {
    return this.loyaltyEngine.getCustomerTier(customerId, organizationId);
  }
}