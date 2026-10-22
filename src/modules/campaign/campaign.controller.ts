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
import { CampaignService } from './campaign.service';
import { CallStatuses } from 'src/common/enums/status-codes';
import { CampaignResponseCodes } from './enums/responseCodes';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';
import { CreateOrEditOrganizationCampaignForm } from './DTO/campaign.dto';

@ApiTags('Campaign')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('campaign')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post('/create-organization-level-campaign')
  async create_organization_level_campaign(
    @Body() form: CreateOrEditOrganizationCampaignForm & { organizationId: string },
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const { organizationId, ...data } = form;
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
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const data = await this.campaignService.getOrganizationLevelCampaigns(
      organizationId,
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
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const data = await this.campaignService.getOrganizationLevelCampaign(
      organizationId,
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
    @Body() form: CreateOrEditOrganizationCampaignForm & { organizationId: string },
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const { organizationId, ...data } = form;
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
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const data =
      await this.campaignService.getActiveCampaignOfOrganizationAndTheirPotentialEarning(
        form,
      );
    return {
      status: CallStatuses.Success,
      code: CampaignResponseCodes.Potential_Earning_Calculated,
      data,
    };
  }
}
