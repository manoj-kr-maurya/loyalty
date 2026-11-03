import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CallStatuses } from 'src/common/enums/status-codes';
import { ApiKeyService, OrganizationAuthContext } from './api-key.service';
import { OrganizationApiKeyGuard } from './guards/organization-api-key.guard';
import { ScopesGuard } from './guards/scopes.guard';
import { RequireScopes } from './decorators/require-scopes.decorator';
import { CurrentAuth } from './decorators/current-auth.decorator';
import { resolveOrganizationId } from './resolve-organization-id';
import { ApiKeyOrganizationQueryDto, CreateApiKeyDto } from './DTO/api-key.dto';

@ApiTags('organization-api-keys')
@ApiSecurity('x-api-key')
@UseGuards(OrganizationApiKeyGuard, ScopesGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @RequireScopes('api-keys:manage')
  @ApiOperation({
    summary: 'Create an organization API key (plaintext returned once)',
  })
  async create(
    @Body() body: CreateApiKeyDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, body.organizationId);

    const apiKey = await this.apiKeyService.create({
      organizationId,
      name: body.name,
      scopes: body.scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });

    return { status: CallStatuses.Success, data: apiKey };
  }

  @Get()
  @RequireScopes('api-keys:manage')
  @ApiOperation({ summary: 'List API keys for an organization' })
  async list(
    @Query() query: ApiKeyOrganizationQueryDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, query.organizationId);
    const result = await this.apiKeyService.list(organizationId);

    return { status: CallStatuses.Success, ...result };
  }

  @Delete(':id')
  @RequireScopes('api-keys:manage')
  @ApiOperation({ summary: 'Revoke an organization API key' })
  async revoke(
    @Param('id') id: string,
    @Query() query: ApiKeyOrganizationQueryDto,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(auth, query.organizationId);
    const result = await this.apiKeyService.revoke(id, organizationId);

    return { status: CallStatuses.Success, data: result };
  }
}
