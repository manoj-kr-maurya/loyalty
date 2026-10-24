import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
} from '@nestjs/swagger';
import { OrganizationApiKeyGuard } from 'src/modules/auth/guards/organization-api-key.guard';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';
import { buildSchemaForOrg } from 'src/common/validation/validation-policies';
import {
  PromoService,
  EvaluatePromotionsInput,
  CouponCheckInput,
} from './promo.service';
import {
  CouponCodeService,
  GenerateCodeInput,
  ValidateCodeInput,
} from './coupon-code.service';
import {
  PromotionDto,
  PromotionSchema,
  GetActivePromotionsDto,
  GetActivePromotionsSchema,
  CouponCheckDto,
  CouponCheckSchema,
} from './DTO/promotion.dto';
import { CouponAllocation, CouponClaim } from './coupon-manager.service';
import { ClaimInput } from './claim-manager.service';
import { DeprecatedApi } from 'src/interceptors/deprecation/deprecated-api.decorator';

@ApiTags('Promo')
@ApiSecurity('x-api-key')
@DeprecatedApi({
  sunset: '2027-06-30T00:00:00Z',
  replacement: '/engines/promo',
})
@UseGuards(OrganizationApiKeyGuard)
@Controller('promo')
export class PromoController {
  constructor(
    private readonly promoService: PromoService,
    private readonly couponCodeService: CouponCodeService,
  ) {}

  @Post('/create')
  @UsePipes(
    new JoiValidationPipe((form: any) =>
      buildSchemaForOrg(PromotionSchema, form?.organizationId),
    ),
  )
  @ApiOperation({ summary: 'Create a new promotion' })
  async createPromotion(
    @Body() form: PromotionDto & { organizationId: string },
  ) {
    const { organizationId, ...data } = form;
    return this.promoService.createAndPersistPromotion(organizationId, data);
  }

  @Post('/evaluate')
  @ApiOperation({ summary: 'Evaluate active promotions for a transaction' })
  async evaluatePromotions(@Body() input: EvaluatePromotionsInput) {
    return this.promoService.evaluatePromotions(input);
  }

  @Post('/active')
  @ApiOperation({
    summary:
      'Get active promotions for an organization (owned coupon-list contract)',
  })
  async getActivePromotions(
    @Body(
      new JoiValidationPipe((body: any) =>
        buildSchemaForOrg(GetActivePromotionsSchema, body?.organizationId),
      ),
    )
    body: GetActivePromotionsDto,
  ) {
    return this.promoService.getActivePromotions(body.organizationId, {
      organizationId: body.organizationId,
      customerId: body.customerId,
      cartValue: body.cartValue,
      cartCategories: body.cartCategories,
      isBankOffer: body.isBankOffer,
      channel: body.channel,
      page: body.page,
      limit: body.limit,
    } as any);
  }

  @Get('/list')
  @ApiOperation({ summary: 'List promotions in raw shape for admin dashboard' })
  @ApiQuery({ name: 'organizationId', required: true })
  async listPromotions(@Query('organizationId') organizationId: string) {
    return this.promoService.listPromotions(organizationId);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get a promotion by ID' })
  async getPromotionById(@Param('id') id: string) {
    return this.promoService.getPromotionById(id);
  }

  @Post('/:id/update')
  @ApiOperation({ summary: 'Update a promotion' })
  async updatePromotion(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(PromotionSchema)) form: PromotionDto,
  ) {
    return this.promoService.updatePromotion(id, form);
  }

  @Post('/:id/rules')
  @ApiOperation({ summary: 'Add or replace rules for a promotion' })
  async upsertRules(
    @Param('id') programId: string,
    @Body()
    body: {
      rules: Array<{
        name: string;
        rewardType: string;
        rewardMode: string;
        value: number;
        conditions: any;
        threshold?: number;
        ratioBase?: number;
        meta?: any;
      }>;
    },
  ) {
    return this.promoService.upsertRules(programId, body.rules);
  }

  @Post('/coupon/check')
  @UsePipes(new JoiValidationPipe(CouponCheckSchema))
  @ApiOperation({
    summary:
      'Check a coupon against customer eligibility and cart value; returns applicability and computed discount',
  })
  async checkCoupon(@Body() body: CouponCheckDto) {
    return this.promoService.checkCouponOnCart(body as CouponCheckInput);
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

  // ─── Coupon Code (Auto-generated) ─────────────────────────────

  @Post('/codes/generate')
  @ApiOperation({
    summary: 'Generate auto-generated coupon codes for a promotion',
  })
  async generateCodes(@Body() input: GenerateCodeInput) {
    return this.couponCodeService.generateCodes(input);
  }

  @Post('/codes/validate')
  @ApiOperation({ summary: 'Validate a coupon code' })
  async validateCode(@Body() input: ValidateCodeInput) {
    return this.couponCodeService.validateCode(input);
  }

  @Post('/codes/allocate')
  @ApiOperation({
    summary: 'Allocate an available code to a specific customer',
  })
  async allocateCode(
    @Body('programId') programId: string,
    @Body('customerId') customerId: string,
  ) {
    return this.couponCodeService.allocateCode(programId, customerId);
  }

  @Post('/codes/claim')
  @ApiOperation({ summary: 'Claim/finalize a coupon code usage' })
  async claimCode(
    @Body('code') code: string,
    @Body('customerId') customerId: string,
    @Body('transactionRef') transactionRef?: string,
  ) {
    return this.couponCodeService.claimCode(code, customerId, transactionRef);
  }

  @Get('/codes/:programId')
  @ApiOperation({ summary: 'List all coupon codes for a promotion' })
  @ApiQuery({ name: 'customerId', required: false })
  async listCodes(
    @Param('programId') programId: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.couponCodeService.listCodes(programId, customerId);
  }

  @Get('/codes/:programId/customer/:customerId')
  @ApiOperation({ summary: 'Get coupon code for a specific customer' })
  async getCodeByCustomer(
    @Param('programId') programId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.couponCodeService.getCodeByCustomer(programId, customerId);
  }
}
