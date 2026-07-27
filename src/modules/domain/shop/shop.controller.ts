import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CallStatuses } from 'src/common/enums/status-codes';
import { VerifyJWTAndFetchPayload } from 'src/interceptors/auth/verify-jwt-and-fetch-payload';
import { RequestWithJWTTokenPayloadAndToken } from '../auth/DTO/jwt.dto';
import { UpdateOrganizationForm } from '../organization/DTO/organizations.dto';
import { UpdateShopForm } from './DTO/shop.dto';
import { ShopResponseCodes } from './enums/responseCodes';
import { ShopService } from './shop.service';

@ApiTags('Shops of an Organization')
@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('/fetch-active-shops-by-org-id')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async fetchActiveShopsOfAnOrg(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
  ) {
    const organizationAdminId = request.tokenPayload.sub;

    const shops = await this.shopService.fetchActiveShopsOfAnOrg(
      organizationAdminId,
    );
    return {
      code: ShopResponseCodes.Fetched_Active_Shops,
      status: CallStatuses.Success,
      data: shops,
    };
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
    @Body() form: UpdateShopForm,
  ) {
    const organizationAdminId = request.tokenPayload.sub;
    const shop = await this.shopService.updateShop(organizationAdminId, form);
    return {
      status: CallStatuses.Success,
      code: ShopResponseCodes.Shop_Updated,
      data: shop,
    };
  }
}
