import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CallStatuses } from 'src/common/enums/status-codes';
import { CampaignResponseCodes } from './enums/responseCodes';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrganizationApiKeyGuard } from 'src/modules/auth/guards/organization-api-key.guard';
import { CurrentAuth } from 'src/modules/auth/decorators/current-auth.decorator';
import { OrganizationAuthContext } from 'src/modules/auth/api-key.service';
import { resolveOrganizationId } from 'src/modules/auth/resolve-organization-id';
import { CreateOrEditOrganizationCampaignForm } from './DTO/campaign.dto';

@ApiTags('Campaign')
@ApiSecurity('x-api-key')
@UseGuards(OrganizationApiKeyGuard)
@Controller('campaign')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post('/create-organization-level-campaign')
  async create_organization_level_campaign(
    @Body()
    form: CreateOrEditOrganizationCampaignForm & { organizationId?: string },
    @CurrentAuth() auth: OrganizationAuthContext,
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const { organizationId: requestedOrganizationId, ...data } = form;
    const organizationId = resolveOrganizationId(auth, requestedOrganizationId);
    const result = await this.campaignService.createOrganizationLevelCampaign(
      data as any,
      organizationId,
    );
    return {
      status: CallStatuses.Success,
      code: CampaignResponseCodes.Campaign_Created,
      data: result,
    };
  }

  @Get('/get-organization-level-campaigns')
  async get_organization_level_campaigns(
    @Query('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    const data = await this.campaignService.getOrganizationLevelCampaigns(
      effectiveOrganizationId,
    );
    return {
      status: CallStatuses.Success,
      code: CampaignResponseCodes.Campaigns_Fetched,
      data,
    };
  }

  @Get('/get-organization-level-campaign/:id')
  async get_organization_level_campaign(
    @Query('organizationId') organizationId: string,
    @Param('id') id: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    const data = await this.campaignService.getOrganizationLevelCampaign(
      effectiveOrganizationId,
      id,
    );
    return {
      status: CallStatuses.Success,
      code: CampaignResponseCodes.Campaign_Fetched,
      data,
    };
  }

  @Post('/update-organization-level-campaign')
  async update_organization_level_campaign(
    @Body()
    form: CreateOrEditOrganizationCampaignForm & { organizationId?: string },
    @CurrentAuth() auth: OrganizationAuthContext,
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const { organizationId: requestedOrganizationId, ...data } = form;
    const organizationId = resolveOrganizationId(auth, requestedOrganizationId);
    const result = await this.campaignService.updateOrganizationLevelCampaign(
      data as any,
      organizationId,
    );
    return {
      status: CallStatuses.Success,
      code: CampaignResponseCodes.Campaign_Updated,
      data: result,
    };
  }

  @Post('/get-active-campaigns-potential-earning')
  async getActiveCampaignOfOrganizationAndTheirPotentialEarning(
    @Body() form: any,
    @CurrentAuth() auth: OrganizationAuthContext,
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const organizationId = resolveOrganizationId(auth, form.organizationId);
    const data =
      await this.campaignService.getActiveCampaignOfOrganizationAndTheirPotentialEarning(
        { ...form, organizationId },
      );
    return {
      status: CallStatuses.Success,
      code: CampaignResponseCodes.Potential_Earning_Calculated,
      data,
    };
  }
}
