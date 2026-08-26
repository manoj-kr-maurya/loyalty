import { Body, Controller, Get, Param, Post, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiSecurity } from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';
import { PromoService, EvaluatePromotionsInput } from './promo.service';
import { PromotionDto, PromotionSchema } from './DTO/promotion.dto';
import { CouponAllocation, CouponClaim } from './coupon-manager.service';
import { ClaimInput } from './claim-manager.service';

@ApiTags('Promo')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('promo')
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  @Post('/create')
  @UsePipes(new JoiValidationPipe(PromotionSchema))
  @ApiOperation({ summary: 'Create a new promotion' })
  async createPromotion(@Body() form: PromotionDto & { organizationId: string }) {
    const { organizationId, ...data } = form;
    return this.promoService.createAndPersistPromotion(organizationId, data);
  }

  @Post('/evaluate')
  @ApiOperation({ summary: 'Evaluate active promotions for a transaction' })
  async evaluatePromotions(@Body() input: EvaluatePromotionsInput) {
    return this.promoService.evaluatePromotions(input);
  }

  @Get('/')
  @ApiOperation({ summary: 'Get active promotions for an organization' })
  @ApiQuery({ name: 'organizationId', required: true })
  async getActivePromotions(@Query('organizationId') organizationId: string) {
    return this.promoService.getActivePromotions(organizationId);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get a promotion by ID' })
  async getPromotionById(@Param('id') id: string) {
    return this.promoService.getPromotionById(id);
  }

  @Post('/:id/update')
  @UsePipes(new JoiValidationPipe(PromotionSchema))
  @ApiOperation({ summary: 'Update a promotion' })
  async updatePromotion(@Param('id') id: string, @Body() form: PromotionDto) {
    return this.promoService.updatePromotion(id, form);
  }

  @Post('/:id/rules')
  @ApiOperation({ summary: 'Add or replace rules for a promotion' })
  async upsertRules(
    @Param('id') programId: string,
    @Body() body: { rules: Array<{ name: string; rewardType: string; rewardMode: string; value: number; conditions: any; threshold?: number; ratioBase?: number; meta?: any }> },
  ) {
    return this.promoService.upsertRules(programId, body.rules);
  }

  @Post('/coupon/allocate')
  @ApiOperation({ summary: 'Allocate a new coupon to a customer' })
  async allocateCoupon(@Body() allocation: CouponAllocation) {
    return this.promoService.allocateCoupon(allocation);
  }

  @Post('/coupon/block')
  @ApiOperation({ summary: 'Block (reserve) a coupon' })
  async blockCoupon(@Body('blockId') blockId: string) {
    return this.promoService.blockCoupon(blockId);
  }

  @Post('/coupon/release')
  @ApiOperation({ summary: 'Release a blocked coupon' })
  async releaseCoupon(
    @Body('blockId') blockId: string,
    @Body('reason') reason?: string,
  ) {
    return this.promoService.releaseCoupon(blockId, reason);
  }

  @Post('/coupon/claim')
  @ApiOperation({ summary: 'Claim a coupon (finalize usage)' })
  async claimCoupon(@Body() claim: CouponClaim) {
    return this.promoService.claimCoupon(claim);
  }

  @Get('/coupon/customer/:customerId')
  @ApiOperation({ summary: 'Get all coupons for a customer' })
  async getCustomerCoupons(@Param('customerId') customerId: string) {
    return this.promoService.getCustomerCoupons(customerId);
  }

  @Get('/coupon/:blockId')
  @ApiOperation({ summary: 'Get a coupon by block ID' })
  async getCoupon(@Param('blockId') blockId: string) {
    return this.promoService.getCoupon(blockId);
  }

  @Post('/claim/record')
  @ApiOperation({ summary: 'Record a new claim' })
  async recordClaim(@Body() input: ClaimInput) {
    return this.promoService.recordClaim(input);
  }

  @Post('/claim/revoke')
  @ApiOperation({ summary: 'Revoke a claim' })
  async revokeClaim(
    @Body('claimId') claimId: string,
    @Body('reason') reason: string,
    @Body('actor') actor?: string,
  ) {
    return this.promoService.revokeClaim(claimId, reason, actor);
  }

  @Get('/claim/:id')
  @ApiOperation({ summary: 'Get a claim by ID' })
  async getClaimById(@Param('id') id: string) {
    return this.promoService.getClaimById(id);
  }

  @Get('/claim/summary/:customerId')
  @ApiOperation({ summary: 'Get claim summary for a customer' })
  async getCustomerClaimSummary(@Param('customerId') customerId: string) {
    return this.promoService.getCustomerClaimSummary(customerId);
  }
}
