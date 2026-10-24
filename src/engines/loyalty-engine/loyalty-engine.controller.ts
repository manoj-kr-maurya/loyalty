import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrganizationApiKeyGuard } from 'src/modules/auth/guards/organization-api-key.guard';
import { ScopesGuard } from 'src/modules/auth/guards/scopes.guard';
import { RequireScopes } from 'src/modules/auth/decorators/require-scopes.decorator';
import { CurrentAuth } from 'src/modules/auth/decorators/current-auth.decorator';
import { OrganizationAuthContext } from 'src/modules/auth/api-key.service';
import { resolveOrganizationId } from 'src/modules/auth/resolve-organization-id';
import { LoyaltyEngineService } from './loyalty-engine.service';
import { LedgerQueryService } from './services/ledger-query.service';
import { WebhookService } from './services/webhook.service';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import {
  CreateWebhookDto,
  OrganizationQueryDto,
  WebhookDeliveryQueryDto,
  WebhookEndpointQueryDto,
} from './dto/webhook.dto';
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
@UseGuards(OrganizationApiKeyGuard, ScopesGuard)
@Controller('engines/loyalty')
export class LoyaltyEngineController {
  constructor(
    private readonly loyaltyEngine: LoyaltyEngineService,
    private readonly ledgerQuery: LedgerQueryService,
    private readonly webhooks: WebhookService,
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
      ],
    };
  }

  // ─── Tiers ────────────────────────────────────────────

  @Post('tiers')
  @RequireScopes('loyalty:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create or update loyalty tiers for an organization',
  })
  async upsertTiers(
    @Body() body: UpsertTiersDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, body.organizationId);

    return this.loyaltyEngine.upsertTiers({ ...body, organizationId });
  }

  @Get('tiers/:organizationId')
  @RequireScopes('loyalty:read')
  @ApiOperation({ summary: 'Get loyalty tiers for an organization' })
  async getTiers(
    @Param('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const scopedOrganizationId = resolveOrganizationId(auth, organizationId);

    return this.loyaltyEngine.getTiers(scopedOrganizationId);
  }

  // ─── Earn / Burn ──────────────────────────────────────

  @Post('earn')
  @RequireScopes('loyalty:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Earn loyalty points (idempotent)' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  async earnPoints(
    @Body() body: EarnPointsDto,
    @CurrentAuth() auth: OrganizationAuthContext,
    @Headers('idempotency-key') headerIdempotencyKey?: string,
  ) {
    const organizationId = resolveOrganizationId(auth, body.organizationId);

    return this.loyaltyEngine.earnPoints({
      ...body,
      organizationId,
      idempotencyKey: headerIdempotencyKey || body.idempotencyKey,
    });
  }

  @Post('burn')
  @RequireScopes('loyalty:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Burn loyalty points using FIFO pockets (idempotent)',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  async burnPoints(
    @Body() body: BurnPointsDto,
    @CurrentAuth() auth: OrganizationAuthContext,
    @Headers('idempotency-key') headerIdempotencyKey?: string,
  ) {
    const organizationId = resolveOrganizationId(auth, body.organizationId);

    return this.loyaltyEngine.burnPoints({
      ...body,
      organizationId,
      idempotencyKey: headerIdempotencyKey || body.idempotencyKey,
    });
  }

  // ─── Estimate ─────────────────────────────────────────

  @Post('estimate')
  @RequireScopes('loyalty:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estimate points that would be earned (no writes)' })
  async estimatePoints(
    @Body() body: EstimatePointsDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, body.organizationId);

    return this.loyaltyEngine.estimatePoints({ ...body, organizationId });
  }

  // ─── Expiry ───────────────────────────────────────────

  @Post('expire')
  @RequireScopes('loyalty:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Expire points for an organization currency' })
  async expirePoints(
    @Body() body: ExpirePointsDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, body.organizationId);

    return this.loyaltyEngine.expirePoints({
      ...body,
      organizationId,
      expiryDate: new Date(body.expiryDate),
    });
  }

  // ─── Statement ────────────────────────────────────────

  @Post('statement')
  @RequireScopes('loyalty:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a loyalty statement for a customer' })
  async generateStatement(
    @Body() body: LoyaltyStatementDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, body.organizationId);

    return this.loyaltyEngine.generateStatement({
      ...body,
      organizationId,
      currencyCode: body.currencyCode,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    });
  }

  // ─── Ledger ───────────────────────────────────────────

  @Get('ledger/:customerId')
  @RequireScopes('loyalty:read')
  @ApiOperation({ summary: 'List a customer ledger with filters' })
  async getLedger(
    @Param('customerId') customerId: string,
    @Query() query: LedgerQueryDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, query.organizationId);

    return this.ledgerQuery.list(customerId, organizationId, query);
  }

  // ─── Webhooks ─────────────────────────────────────────

  @Post('webhooks')
  @RequireScopes('webhooks:manage')
  @ApiOperation({
    summary: 'Register a webhook endpoint (secret returned once)',
  })
  async createWebhook(
    @Body() body: CreateWebhookDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, body.organizationId);

    return this.webhooks.createEndpoint({ ...body, organizationId });
  }

  @Get('webhooks')
  @RequireScopes('webhooks:manage')
  @ApiOperation({ summary: 'List webhook endpoints for an organization' })
  async listWebhooks(
    @Query() query: WebhookEndpointQueryDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, query.organizationId);

    return this.webhooks.listEndpoints({ ...query, organizationId });
  }

  @Delete('webhooks/:id')
  @RequireScopes('webhooks:manage')
  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  async deleteWebhook(
    @Param('id') id: string,
    @Query() query: OrganizationQueryDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, query.organizationId);

    return this.webhooks.deleteEndpoint(id, organizationId);
  }

  @Get('webhooks/:id/deliveries')
  @RequireScopes('webhooks:manage')
  @ApiOperation({ summary: 'List webhook delivery attempts' })
  async listWebhookDeliveries(
    @Param('id') id: string,
    @Query() query: WebhookDeliveryQueryDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, query.organizationId);

    return this.webhooks.listDeliveries({
      ...query,
      organizationId,
      endpointId: id,
    });
  }

  // ─── Tier Status ──────────────────────────────────────

  @Get('tier-status/:customerId/:organizationId')
  @RequireScopes('loyalty:read')
  @ApiOperation({ summary: 'Get a customer tier status' })
  async getCustomerTier(
    @Param('customerId') customerId: string,
    @Param('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const scopedOrganizationId = resolveOrganizationId(auth, organizationId);

    return this.loyaltyEngine.getCustomerTier(customerId, scopedOrganizationId);
  }
}
