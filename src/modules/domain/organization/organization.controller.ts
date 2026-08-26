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
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiSecurity } from '@nestjs/swagger';
import { CallStatuses } from 'src/common/enums/status-codes';
import {
  LoginOrganizationOtpForm,
  LoginOrganizationOtpSchema,
  ValidateOrganizationOtpForm,
  ValidateOrganizationOtpSchema,
  UpdateOrganizationForm,
  UpdateOrganizationSchema,
  InviteShopForm,
  InviteShopSchema,
} from './DTO/organizations.dto';
import { OrganizationResponseCodes } from './enums/responseCodes';
import { OrganizationService } from './organization.service';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';

@ApiTags('Organization')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  // ─── Public endpoints (no auth) ────────────────────────────────

  @Post('/otp/phone')
  @UsePipes(new JoiValidationPipe(LoginOrganizationOtpSchema))
  @ApiOperation({ summary: 'Send OTP for phone authentication' })
  @ApiBody({ type: LoginOrganizationOtpForm })
  @ApiResponse({ status: 200, description: 'OTP sent successfully.' })
  async findOrCreateOrganizationAndProceedOTPAuthentication(
    @Body() form: { countryCode: string; phoneNumber: string; name?: string; role?: string; orgAdminId?: string },
  ) {
    const organizationId =
      await this.organizationService.findOrCreateOrganizationAndProceedPhoneAuthentication(
        form as any,
      );
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Organization_Sent_Otp,
      data: organizationId,
    };
  }

  @Post('/otp/validate')
  @UsePipes(new JoiValidationPipe(ValidateOrganizationOtpSchema))
  @ApiOperation({ summary: 'Validate OTP and generate token' })
  @ApiBody({ type: ValidateOrganizationOtpForm })
  @ApiResponse({ status: 200, description: 'OTP validated and token generated.' })
  async validateOtpAndGenerateToken(@Body() form: { otp: string; id: string }) {
    const { metaFlags, organization } =
      await this.organizationService.validateOtpAndGenerateToken(form as any);
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Organization_Verified,
      data: { organization, metaFlags },
    };
  }

  @Post('/send-interest')
  @ApiOperation({ summary: 'Send interest' })
  @ApiBody({ type: Object })
  @ApiResponse({ status: 200, description: 'Interest sent successfully.' })
  async sendInterest(@Body() form: { phoneNumber: string }) {
    await this.organizationService.sendInterest(form as any);
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Send_Interest,
    };
  }

  // ─── Protected endpoints (API key required) ─────────────────────

  @Get('/get-your-admin')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('x-api-key')
  @ApiOperation({ summary: 'Get your admin details' })
  @ApiResponse({ status: 200, description: 'Admin details fetched successfully.' })
  async getYourAdmin(
    @Query('organizationId') organizationId: string,
    @Query('orgAdminId') orgAdminId: string,
  ) {
    const organization = await this.organizationService.getYourAdmin(
      orgAdminId,
      organizationId,
    );
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Fetched_Your_Admin,
      data: organization,
    };
  }

  @Get(`/`)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('x-api-key')
  @ApiOperation({ summary: 'Get organization details' })
  @ApiResponse({ status: 200, description: 'Organization details fetched successfully.' })
  async getOrganization(@Query('organizationId') organizationId: string) {
    const { metaFlags, organization } =
      await this.organizationService.getOrganizationAndMetaFlags(organizationId);
    return {
      status: CallStatuses.Success,
      data: { organization, metaFlags },
      code: OrganizationResponseCodes.Organization_Fetched,
    };
  }

  @Post(`/logout`)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('x-api-key')
  @ApiOperation({ summary: 'Logout organization' })
  @ApiResponse({ status: 200, description: 'Organization logged out successfully.' })
  async logoutOrganization(@Body('organizationId') organizationId: string) {
    return await this.organizationService.logoutOrganization(organizationId);
  }

  @Post('/update')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('x-api-key')
  @UsePipes(new JoiValidationPipe(UpdateOrganizationSchema))
  @ApiOperation({ summary: 'Update organization details' })
  @ApiBody({ type: UpdateOrganizationForm })
  @ApiResponse({ status: 200, description: 'Organization updated successfully.' })
  async updateOrganization(
    @Body() form: { organizationId: string; name?: string; address?: string; base64Logo?: string; base64Cover?: string; upiURI?: string; contactUs?: string; operationalHours?: string; aboutUs?: string },
  ) {
    const { organizationId, ...data } = form;
    const organization =
      await this.organizationService.someFunctionThatMyUpdateOrganizationEndPointWillCall(
        organizationId,
        data,
      );
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Organization_Updated,
      data: organization,
    };
  }

  @Post('/invite-shop')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('x-api-key')
  @UsePipes(new JoiValidationPipe(InviteShopSchema))
  @ApiOperation({ summary: 'Invite a shop' })
  @ApiBody({ type: InviteShopForm })
  @ApiResponse({ status: 200, description: 'Shop invited successfully.' })
  async inviteShop(
    @Body() form: { organizationId: string; phoneNumber: string; location: string },
  ) {
    const { organizationId, ...data } = form;
    const invResult = await this.organizationService.inviteShop(
      data as any,
      organizationId,
    );
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Invited_Shop,
      data: invResult,
    };
  }

  @Get('/invited-shops')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('x-api-key')
  @ApiOperation({ summary: 'Get invited shops' })
  @ApiResponse({ status: 200, description: 'Invited shops fetched successfully.' })
  async getInvitedShops(@Query('organizationId') organizationId: string) {
    const invites = await this.organizationService.getInvitedShops(organizationId);
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Fetched_Shop_Invites,
      data: invites,
    };
  }

  @Get('/leader-board/top-organizations')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('x-api-key')
  async getTopOrganizationsForLeaderBoard(@Query() query: PaginationQueryDto) {
    const leaderBoardEntries =
      await this.organizationService.getTopOrganizationsForLeaderBoard(query);
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Leader_Board_Organizations_Fetched,
      data: leaderBoardEntries,
    };
  }

  @Get('/leader-board/organization/detail/:orgAdminId')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('x-api-key')
  async getTopOrganizationDetailForLeaderBoard(
    @Query('organizationId') organizationId: string,
    @Param('orgAdminId') orgAdminId: string,
  ) {
    const leaderBoardEntry =
      await this.organizationService.getTopOrganizationDetailForLeaderBoard(
        organizationId,
        orgAdminId,
      );
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Leader_Board_Organization_Detail_Fetched,
      data: leaderBoardEntry,
    };
  }
}
