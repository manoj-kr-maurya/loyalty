import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { LoyaltyEngineService } from './loyalty-engine.service';
import { LedgerQueryService } from './services/ledger-query.service';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import {
  BurnPointsDto,
  EarnPointsDto,
  EstimatePointsDto,
  ExpirePointsDto,
  LoyaltyStatementDto,
  UpsertTiersDto,
} from './dto/loyalty-engine.dto';

@ApiTags('engines-loyalty')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('engines/loyalty')
export class LoyaltyEngineController {
  constructor(
    private readonly loyaltyEngine: LoyaltyEngineService,
    private readonly ledgerQuery: LedgerQueryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Loyalty engine service info' })
  getServiceInfo() {
    return {
      name: 'Loyalty Engine',
      version: '1.0',
      status: 'ok',
      capabilities: [
        'tiers',
        'earn',
        'burn',
        'estimate',
        'expire',
        'statement',
        'tier-status',
        'ledger',
        'webhooks',
        'expiry-rules',
        'points-value',
        'transfer',
      ],
    };
  }

  // ─── Tiers ────────────────────────────────────────────

  @Post('tiers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create or update loyalty tiers for an organization',
  })
  async upsertTiers(@Body() body: UpsertTiersDto) {
    return this.loyaltyEngine.upsertTiers(body);
  }

  @Get('tiers/:organizationId')
  @ApiOperation({ summary: 'Get loyalty tiers for an organization' })
  async getTiers(@Param('organizationId') organizationId: string) {
    return this.loyaltyEngine.getTiers(organizationId);
  }

  // ─── Earn / Burn ──────────────────────────────────────

  @Post('earn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Earn loyalty points (idempotent)' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  async earnPoints(
    @Body() body: EarnPointsDto,
    @Headers('idempotency-key') headerIdempotencyKey?: string,
  ) {
    return this.loyaltyEngine.earnPoints({
      ...body,
      idempotencyKey: headerIdempotencyKey || body.idempotencyKey,
    });
  }

  @Post('burn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Burn loyalty points using FIFO pockets (idempotent)',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  async burnPoints(
    @Body() body: BurnPointsDto,
    @Headers('idempotency-key') headerIdempotencyKey?: string,
  ) {
    return this.loyaltyEngine.burnPoints({
      ...body,
      idempotencyKey: headerIdempotencyKey || body.idempotencyKey,
    });
  }

  // ─── Estimate ─────────────────────────────────────────

  @Post('estimate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estimate points that would be earned (no writes)' })
  async estimatePoints(@Body() body: EstimatePointsDto) {
    return this.loyaltyEngine.estimatePoints(body);
  }

  // ─── Expiry ───────────────────────────────────────────

  @Post('expire')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Expire points for an organization currency' })
  async expirePoints(@Body() body: ExpirePointsDto) {
    return this.loyaltyEngine.expirePoints({
      ...body,
      expiryDate: new Date(body.expiryDate),
    });
  }

  // ─── Statement ────────────────────────────────────────

  @Post('statement')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a loyalty statement for a customer' })
  async generateStatement(@Body() body: LoyaltyStatementDto) {
    return this.loyaltyEngine.generateStatement({
      ...body,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    });
  }

  // ─── Ledger ───────────────────────────────────────────

  @Get('ledger/:customerId')
  @ApiOperation({ summary: 'List a customer ledger with filters' })
  async getLedger(
    @Param('customerId') customerId: string,
    @Query() query: LedgerQueryDto,
  ) {
    return this.ledgerQuery.list(customerId, query);
  }

  // ─── Tier Status ──────────────────────────────────────

  @Get('tier-status/:customerId/:organizationId')
  @ApiOperation({ summary: 'Get a customer tier status' })
  async getCustomerTier(
    @Param('customerId') customerId: string,
    @Param('organizationId') organizationId: string,
  ) {
    return this.loyaltyEngine.getCustomerTier(customerId, organizationId);
  }
}
