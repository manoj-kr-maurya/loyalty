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
import { PromoCodeService } from '../application/promo-code.service';

@ApiTags('engines-promo')
@ApiSecurity('x-api-key')
@UseGuards(OrganizationApiKeyGuard, ScopesGuard)
@Controller('engines/promo')
export class PromoEngineController {
  constructor(private readonly promoCodeService: PromoCodeService) {}

  // ─── Promo Code CRUD ──────────────────────────────────

  @Post('codes')
  @RequireScopes('promo:write')
  @HttpCode(HttpStatus.CREATED)
  async createPromoCode(
    @Body()
    body: {
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
    },
  ) {
    return this.promoCodeService.createPromoCode({
      ...body,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
    });
  }

  // ─── Validate ─────────────────────────────────────────

  @Post('validate')
  @RequireScopes('promo:read')
  @HttpCode(HttpStatus.OK)
  async validatePromoCode(
    @Body()
    body: {
      code: string;
      organizationId: string;
      customerId: string;
      orderAmount: number;
      productIds?: string[];
    },
  ) {
    return this.promoCodeService.validatePromoCode(body);
  }

  // ─── Redeem ───────────────────────────────────────────

  @Post('redeem')
  @RequireScopes('promo:write')
  @HttpCode(HttpStatus.OK)
  async redeemPromoCode(
    @Body()
    body: {
      code: string;
      organizationId: string;
      customerId: string;
      orderAmount: number;
      orderRef?: string;
    },
  ) {
    return this.promoCodeService.redeemPromoCode(body);
  }

  // ─── Stacking ─────────────────────────────────────────

  @Post('stacking')
  @RequireScopes('promo:read')
  @HttpCode(HttpStatus.OK)
  async evaluateStacking(
    @Body()
    body: {
      codes: string[];
      organizationId: string;
      customerId: string;
      orderAmount: number;
    },
  ) {
    return this.promoCodeService.evaluateStacking(body);
  }

  // ─── Redemption History ───────────────────────────────

  @Get('redemptions/:customerId/:organizationId')
  @RequireScopes('promo:read')
  async getRedemptionHistory(
    @Param('customerId') customerId: string,
    @Param('organizationId') organizationId: string,
  ) {
    return this.promoCodeService.getRedemptionHistory(
      customerId,
      organizationId,
    );
  }
}
