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
import { ApiBody, ApiOperation, ApiResponse, ApiSecurity, ApiTags, ApiQuery } from '@nestjs/swagger';
import { CallStatuses } from 'src/common/enums/status-codes';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';
import { UpdateShopForm, UpdateShopSchema } from './DTO/shop.dto';
import { ShopResponseCodes } from './enums/responseCodes';
import { ShopService } from './shop.service';

@ApiTags('Shops of an Organization')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('/fetch-active-shops-by-org-id')
  @ApiQuery({ name: 'organizationId', required: true })
  async fetchActiveShopsOfAnOrg(
    @Query('organizationId') organizationId: string,
  ) {
    const shops = await this.shopService.fetchActiveShopsOfAnOrg(organizationId);
    return {
      code: ShopResponseCodes.Fetched_Active_Shops,
      status: CallStatuses.Success,
      data: shops,
    };
  }

  @Post('/update')
  @UsePipes(new JoiValidationPipe(UpdateShopSchema))
  @ApiOperation({ summary: 'Update shop details' })
  @ApiBody({ type: UpdateShopForm })
  @ApiResponse({ status: 200, description: 'Shop updated successfully.' })
  async updateShop(@Body() form: UpdateShopForm & { organizationId: string }) {
    const { organizationId, ...data } = form;
    const shop = await this.shopService.updateShop(organizationId, data as any);
    return {
      status: CallStatuses.Success,
      code: ShopResponseCodes.Shop_Updated,
      data: shop,
    };
  }
}
