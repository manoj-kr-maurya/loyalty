import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CallStatuses } from 'src/common/enums/status-codes';

import {
  GetYourOrganizationQuery,
  InviteShopForm,
  LoginOrganizationOtpForm,
  ValidateOrganizationOtpForm,
  SendInterestForm,
  UpdateOrganizationForm,
} from './DTO/organizations.dto';
import { OrganizationResponseCodes } from './enums/responseCodes';
import { OrganizationService } from './organization.service';
import {
  RequestWithJWTTokenPayloadAndToken,
  JwtTokenPayload,
} from '../auth/DTO/jwt.dto';
import { VerifyJWTAndFetchPayload } from 'src/interceptors/auth/verify-jwt-and-fetch-payload';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { CacheResponseInterceptor } from 'src/interceptors/cache/cache-response.interceptor';

@ApiTags('Organization')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post('/otp/phone')
  @ApiOperation({ summary: 'Send OTP for phone authentication' })
  @ApiBody({ type: LoginOrganizationOtpForm })
  @ApiResponse({ status: 200, description: 'OTP sent successfully.' })
  async findOrCreateOrganizationAndProceedOTPAuthentication(
    @Body() form: LoginOrganizationOtpForm,
  ) {
    const organizationId =
      await this.organizationService.findOrCreateOrganizationAndProceedPhoneAuthentication(
        form,
      );
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Organization_Sent_Otp,
      data: organizationId,
    };
  }

  @Get('/get-your-admin')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Get your admin details' })
  @ApiResponse({
    status: 200,
    description: 'Admin details fetched successfully.',
  })
  async getYourAdmin(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Query() query: GetYourOrganizationQuery,
  ) {
    const organization = await this.organizationService.getYourAdmin(
      query.orgAdminId,
      request.tokenPayload.sub,
    );
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Fetched_Your_Admin,
      data: organization,
    };
  }

  @Post('/otp/validate')
  @ApiOperation({ summary: 'Validate OTP and generate token' })
  @ApiBody({ type: ValidateOrganizationOtpForm })
  @ApiResponse({
    status: 200,
    description: 'OTP validated and token generated.',
  })
  async validateOtpAndGenerateToken(@Body() form: ValidateOrganizationOtpForm) {
    const { metaFlags, organization } =
      await this.organizationService.validateOtpAndGenerateToken(form);
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Organization_Verified,
      data: { organization, metaFlags },
    };
  }

  @Get(`/`)
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Get organization details' })
  @ApiResponse({
    status: 200,
    description: 'Organization details fetched successfully.',
  })
  async getOrganization(@Req() request: RequestWithJWTTokenPayloadAndToken) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    const { metaFlags, organization } =
      await this.organizationService.getOrganizationAndMetaFlags(
        jwtTokenPayload.sub,
      );
    return {
      status: CallStatuses.Success,
      data: { organization, metaFlags },
      code: OrganizationResponseCodes.Organization_Fetched,
    };
    // bug: DO NOT return full organization.
  }

  @Post(`/logout`)
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Logout organization' })
  @ApiResponse({
    status: 200,
    description: 'Organization logged out successfully.',
  })
  async logoutOrganization(@Req() request: RequestWithJWTTokenPayloadAndToken) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;
    return await this.organizationService.logoutOrganization(
      jwtTokenPayload.sub,
    );
  }

  @Post('/update')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Update organization details' })
  @ApiBody({ type: UpdateOrganizationForm })
  @ApiResponse({
    status: 200,
    description: 'Organization updated successfully.',
  })
  async updateOrganization(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Body() form: UpdateOrganizationForm,
  ) {
    const organizationId = request.tokenPayload.sub;
    const organization =
      await this.organizationService.someFunctionThatMyUpdateOrganizationEndPointWillCall(
        organizationId,
        form,
      );
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Organization_Updated,
      data: organization,
    };
  }

  @Post('/send-interest')
  @ApiOperation({ summary: 'Send interest' })
  @ApiBody({ type: SendInterestForm })
  @ApiResponse({ status: 200, description: 'Interest sent successfully.' })
  async sendInterest(@Body() form: SendInterestForm) {
    await this.organizationService.sendInterest(form);
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Send_Interest,
    };
  }

  @Post('/invite-shop')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Invite a shop' })
  @ApiBody({ type: InviteShopForm })
  @ApiResponse({ status: 200, description: 'Shop invited successfully.' })
  async inviteShop(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Body() form: InviteShopForm,
  ) {
    const data = await this.organizationService.inviteShop(
      form,
      request.tokenPayload.sub,
    );
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Invited_Shop,
      data,
    };
  }

  @Get('/invited-shops')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  @ApiOperation({ summary: 'Get invited shops' })
  @ApiResponse({
    status: 200,
    description: 'Invited shops fetched successfully.',
  })
  async getInvitedShops(@Req() request: RequestWithJWTTokenPayloadAndToken) {
    const invites = await this.organizationService.getInvitedShops(
      request.tokenPayload.sub,
    );
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Fetched_Shop_Invites,
      data: invites,
    };
  }

  @Get('/leader-board/top-organizations')
  @UseInterceptors(
    VerifyJWTAndFetchPayload,
    CacheResponseInterceptor.register({
      ttl: 60, // 1 minute cache TTL
      keyPrefix: 'organization-leaderboard',
      includeQueryParams: true, // This will include any query params in the cache key
    }),
  )
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
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async getTopOrganizationDetailForLeaderBoard(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Param('orgAdminId') orgAdminId: string,
  ) {
    const customerId = request.tokenPayload.sub;
    const leaderBoardEntry =
      await this.organizationService.getTopOrganizationDetailForLeaderBoard(
        customerId,
        orgAdminId,
      );
    return {
      status: CallStatuses.Success,
      code: OrganizationResponseCodes.Leader_Board_Organization_Detail_Fetched,
      data: leaderBoardEntry,
    };
  }
}
