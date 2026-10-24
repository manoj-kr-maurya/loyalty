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
import { OrganizationApiKeyGuard } from 'src/modules/auth/guards/organization-api-key.guard';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';
import { CurrentAuth } from 'src/modules/auth/decorators/current-auth.decorator';
import { OrganizationAuthContext } from 'src/modules/auth/api-key.service';
import { resolveOrganizationId } from 'src/modules/auth/resolve-organization-id';

@ApiTags('Organization-Orders')
@ApiSecurity('x-api-key')
@UseGuards(OrganizationApiKeyGuard)
@Controller('organization/order')
export class OrganizationOrderController {
  constructor(
    private readonly organizationOrderService: OrganizationOrderService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an order for an organization' })
  @ApiResponse({ status: 201, description: 'The order has been successfully created.' })
  async create(
    @Body(new JoiValidationPipe(CreateOrganizationOrderSchema)) createOrderDto: { organizationId?: string; orderType: string; amount?: number; details: any },
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const { organizationId: requestedOrganizationId, ...data } = createOrderDto;
    const organizationId = resolveOrganizationId(
      auth,
      requestedOrganizationId,
    );
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
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const effectiveOrganizationId = resolveOrganizationId(
      auth,
      organizationId,
    );
    const { orgOrders, metadata } =
      await this.organizationOrderService.fetchOrganizationOrders(
        effectiveOrganizationId,
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
  async getOrderById(
    @Param('orderId') orderId: string,
    @Query('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const effectiveOrganizationId = resolveOrganizationId(
      auth,
      organizationId,
    );
    const order = await this.organizationOrderService.getOrganizationOrder(
      orderId,
      effectiveOrganizationId,
    );
    return {
      status: CallStatuses.Success,
      code: organizationOrderResponseCodes.Order_Fetched,
      data: order,
    };
  }

  @Put(':orderId')
  @ApiOperation({ summary: 'Update a specific order for an organization' })
  @ApiResponse({ status: 200, description: 'Order updated successfully.' })
  async update(
    @Param('orderId') orderId: string,
    @Body(new JoiValidationPipe(UpdateOrganizationOrderSchema)) updateOrderDto: { newStatus?: string },
    @Query('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const effectiveOrganizationId = resolveOrganizationId(
      auth,
      organizationId,
    );
    const order =
      await this.organizationOrderService.updateOrganizationOrderForOrganization(
        orderId,
        effectiveOrganizationId,
        updateOrderDto as any,
      );
    return {
      status: CallStatuses.Success,
      code: organizationOrderResponseCodes.Order_Updated,
      data: order,
    };
  }
}
