import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation, ApiBody, ApiSecurity } from '@nestjs/swagger';
import { OrganizationOrderService } from './organization-order.service';
import { CreateOrganizationOrderSchema, UpdateOrganizationOrderSchema } from './DTO/organizationOrder.dto';
import { organizationOrderResponseCodes } from './enums/responseCodes';
import { CallStatuses } from 'src/common/enums/status-codes';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';

@ApiTags('Organization-Orders')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('organization/order')
export class OrganizationOrderController {
  constructor(
    private readonly organizationOrderService: OrganizationOrderService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an order for an organization' })
  @ApiResponse({ status: 201, description: 'The order has been successfully created.' })
  @UsePipes(new JoiValidationPipe(CreateOrganizationOrderSchema))
  async create(
    @Body() createOrderDto: { organizationId: string; orderType: string; amount?: number; details: any },
  ) {
    const { organizationId, ...data } = createOrderDto;
    const orgOrder =
      await this.organizationOrderService.createOrganizationOrder(
        organizationId,
        data as any,
      );
    return {
      status: CallStatuses.Success,
      code: organizationOrderResponseCodes.Order_Created,
      data: orgOrder,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get orders for an organization' })
  @ApiResponse({ status: 200, description: 'List of orders retrieved successfully.' })
  async getOrders(
    @Query('organizationId') organizationId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const { orgOrders, metadata } =
      await this.organizationOrderService.fetchOrganizationOrders(
        organizationId,
        query,
      );
    return {
      status: CallStatuses.Success,
      code: organizationOrderResponseCodes.Orders_Fetched,
      data: orgOrders,
      metadata,
    };
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get a specific order for an organization' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully.' })
  getOrderById(
    @Param('organizationId') organizationId: string,
    @Param('orderId') orderId: string,
  ) {
    // return this.organizationOrderService.findOne(organizationId, orderId);
  }

  @Put(':orderId')
  @ApiOperation({ summary: 'Update a specific order for an organization' })
  @ApiResponse({ status: 200, description: 'Order updated successfully.' })
  @UsePipes(new JoiValidationPipe(UpdateOrganizationOrderSchema))
  update(
    @Param('orderId') orderId: string,
    @Body() updateOrderDto: { newStatus?: string },
  ) {
    // return this.organizationOrderService.update(
    //   organizationId,
    //   orderId,
    //   updateOrderDto,
    // );
  }
}
