import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CallStatuses } from 'src/common/enums/status-codes';
import { CampaignResponseCodes } from './enums/responseCodes';
import {
  CreateOrEditOrganizationCampaignForm,
  PotentialEarningForm,
} from './DTO/campaign.dto';
import { ApiTags } from '@nestjs/swagger';
import {
  RequestWithJWTTokenPayloadAndToken,
  JwtTokenPayload,
} from '../auth/DTO/jwt.dto';
import { VerifyJWTAndFetchPayload } from 'src/interceptors/auth/verify-jwt-and-fetch-payload';
@ApiTags('Campaign')
@Controller('campaign')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post('/create-organization-level-campaign')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async create_organization_level_campaign(
    @Body() form: CreateOrEditOrganizationCampaignForm,
    @Req() request: RequestWithJWTTokenPayloadAndToken,
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    const organizationId = jwtTokenPayload.sub;
    const data = await this.campaignService.createOrganizationLevelCampaign(
      form,
      organizationId,
    );
    return {
      status: CallStatuses.Success,
      code: CampaignResponseCodes.Campaign_Created,
      data,
    };
  }

  @Get('/get-organization-level-campaigns')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async get_organization_level_campaigns(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    const organizationId = jwtTokenPayload.sub;

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
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async get_organization_level_campaign(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Param('id') id: string,
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    const organizationId = jwtTokenPayload.sub;

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
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async update_organization_level_campaign(
    @Body() form: CreateOrEditOrganizationCampaignForm,
    @Req() request: RequestWithJWTTokenPayloadAndToken,
  ): Promise<{ status: CallStatuses; code: CampaignResponseCodes; data: any }> {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    const organizationId = jwtTokenPayload.sub;
    const data = await this.campaignService.updateOrganizationLevelCampaign(
      form,
      organizationId,
    );
    return {
      status: CallStatuses.Success,
      code: CampaignResponseCodes.Campaign_Updated,
      data,
    };
  }

  @Post('/get-active-campaigns-potential-earning')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async getActiveCampaignOfOrganizationAndTheirPotentialEarning(
    @Body() form: PotentialEarningForm,
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
