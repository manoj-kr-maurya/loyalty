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
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { PromoEngineService } from './promo-engine.service';

@ApiTags('engines-promo')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('engines/promo')
export class PromoEngineController {
  constructor(private readonly promoEngine: PromoEngineService) {}

  // ─── Promo Code CRUD ──────────────────────────────────

  @Post('codes')
  @HttpCode(HttpStatus.CREATED)
  async createPromoCode(@Body() body: {
    organizationId: string;
    code: string;
    name?: string;
    description?: string;
    discountType: 'PERCENTAGE' | 'ABSOLUTE' | 'FREE_SHIPPING' | 'BOGO';
    discountValue: number;
    minOrderAmount?: number;
    maxDiscount?: number;
    usageLimit?: number;
    perUserLimit?: number;
    startDate: string;
    endDate: string;
    isStackable?: boolean;
    applicableProducts?: string[];
  }) {
    return this.promoEngine.createPromoCode({
      ...body,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
    });
  }

  // ─── Validate ─────────────────────────────────────────

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validatePromoCode(@Body() body: {
    code: string;
    organizationId: string;
    customerId: string;
    orderAmount: number;
    productIds?: string[];
  }) {
    return this.promoEngine.validatePromoCode(body);
  }

  // ─── Redeem ───────────────────────────────────────────

  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  async redeemPromoCode(@Body() body: {
    code: string;
    organizationId: string;
    customerId: string;
    orderAmount: number;
    orderRef?: string;
  }) {
    return this.promoEngine.redeemPromoCode(body);
  }

  // ─── Stacking ─────────────────────────────────────────

  @Post('stacking')
  @HttpCode(HttpStatus.OK)
  async evaluateStacking(@Body() body: {
    codes: string[];
    organizationId: string;
    customerId: string;
    orderAmount: number;
  }) {
    return this.promoEngine.evaluateStacking(body);
  }

  // ─── Redemption History ───────────────────────────────

  @Get('redemptions/:customerId/:organizationId')
  async getRedemptionHistory(
    @Param('customerId') customerId: string,
    @Param('organizationId') organizationId: string,
  ) {
    return this.promoEngine.getRedemptionHistory(customerId, organizationId);
  }
}