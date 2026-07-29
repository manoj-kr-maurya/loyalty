import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { VerifyJWTAndFetchPayload } from 'src/interceptors/auth/verify-jwt-and-fetch-payload';
import { PromoService, EvaluatePromotionsInput } from './promo.service';
import { PromotionDto } from './DTO/promotion.dto';
import { FilterContext, RuleDefinition } from 'src/modules/core/rule-engine/rule-engine.types';
import { EligibilityCriteria } from 'src/modules/core/eligibility-engine/eligibility-engine.service';
import { BudgetReservation } from 'src/modules/core/budget-engine/budget-engine.service';
import { CouponAllocation, CouponClaim } from './coupon-manager.service';
import { ClaimInput, ClaimQuery } from './claim-manager.service';

@ApiTags('Promo')
@Controller('promo')
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  // ─── Promotion CRUD ────────────────────────────────────────────

  @Post('/create')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Create a new promotion' })
  async createPromotion(@Body() form: PromotionDto) {
    const context: FilterContext = form as any;
    const criteria: EligibilityCriteria = form as any;
    const rules = (form as any).rules ?? [];
    const budgetReservation: BudgetReservation = {
      programId: (form as any).programId ?? '',
      amount: (form as any).amount ?? 0,
      currency: (form as any).currency,
      reference: (form as any).reference,
    };
    return this.promoService.createPromotion(form, context, criteria, rules, budgetReservation);
  }

  // ─── Promotion Evaluation ──────────────────────────────────────

  @Post('/evaluate')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Evaluate active promotions for a transaction' })
  async evaluatePromotions(@Body() input: EvaluatePromotionsInput) {
    return this.promoService.evaluatePromotions(input);
  }

  // ─── Promotion Queries ─────────────────────────────────────────

  @Get('/')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Get active promotions for an organization' })
  @ApiQuery({ name: 'organizationId', required: true })
  async getActivePromotions(@Query('organizationId') organizationId: string) {
    return this.promoService.getActivePromotions(organizationId);
  }

  @Get('/:id')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Get a promotion by ID' })
  async getPromotionById(@Param('id') id: string) {
    return this.promoService.getPromotionById(id);
  }

  // ─── Coupon Operations ─────────────────────────────────────────

  @Post('/coupon/allocate')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Allocate a new coupon to a customer' })
  async allocateCoupon(@Body() allocation: CouponAllocation) {
    return this.promoService.allocateCoupon(allocation);
  }

  @Post('/coupon/block')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Block (reserve) a coupon' })
  async blockCoupon(@Body('blockId') blockId: string) {
    return this.promoService.blockCoupon(blockId);
  }

  @Post('/coupon/release')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Release a blocked coupon' })
  async releaseCoupon(
    @Body('blockId') blockId: string,
    @Body('reason') reason?: string,
  ) {
    return this.promoService.releaseCoupon(blockId, reason);
  }

  @Post('/coupon/claim')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Claim a coupon (finalize usage)' })
  async claimCoupon(@Body() claim: CouponClaim) {
    return this.promoService.claimCoupon(claim);
  }

  @Get('/coupon/customer/:customerId')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Get all coupons for a customer' })
  async getCustomerCoupons(@Param('customerId') customerId: string) {
    return this.promoService.getCustomerCoupons(customerId);
  }

  @Get('/coupon/:blockId')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Get a coupon by block ID' })
  async getCoupon(@Param('blockId') blockId: string) {
    return this.promoService.getCoupon(blockId);
  }

  // ─── Claim Operations ──────────────────────────────────────────

  @Post('/claim/record')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Record a new claim' })
  async recordClaim(@Body() input: ClaimInput) {
    return this.promoService.recordClaim(input);
  }

  @Post('/claim/revoke')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Revoke a claim' })
  async revokeClaim(
    @Body('claimId') claimId: string,
    @Body('reason') reason: string,
    @Body('actor') actor?: string,
  ) {
    return this.promoService.revokeClaim(claimId, reason, actor);
  }

  @Get('/claim/:id')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Get a claim by ID' })
  async getClaimById(@Param('id') id: string) {
    return this.promoService.getClaimById(id);
  }

  @Get('/claim/summary/:customerId')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Get claim summary for a customer' })
  async getCustomerClaimSummary(@Param('customerId') customerId: string) {
    return this.promoService.getCustomerClaimSummary(customerId);
  }
}
