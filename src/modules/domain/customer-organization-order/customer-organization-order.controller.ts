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
import { ApiBody, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CallStatuses } from 'src/common/enums/status-codes';
import { CustomerOrganizationOrderService } from './customer-organization-order.service';
import {
  CreateOrderSchema,
  UpdateOrderStatusSchema,
} from './DTO/customerOrganizationOrder.dto';
import { customerOrganizationOrderResponseCodes } from './enums/responseCodes';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';

@ApiTags('Customer-Organization-Orders')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('customer-organization/order')
export class CustomerOrganizationOrderController {
  constructor(
    private readonly customerOrganizationOrderService: CustomerOrganizationOrderService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an order for a customer to organization' })
  @ApiResponse({ status: 201, description: 'The order has been successfully created.' })
  @UsePipes(new JoiValidationPipe(CreateOrderSchema))
  async createOrder(
    @Body() createOrderDto: { organizationId: string; burningAmountDetails: any; details?: any; idempotencyKey?: string },
  ) {
    const { organizationId, ...data } = createOrderDto;
    const orgOrder =
      await this.customerOrganizationOrderService.createCustomerOrganizationOrder(
        organizationId,
        data as any,
      );
    return {
      status: CallStatuses.Success,
      code: customerOrganizationOrderResponseCodes.Order_Created,
      data: orgOrder,
    };
  }

  @Get('customer')
  @ApiOperation({ summary: 'get orders for a customer to organization' })
  @ApiResponse({ status: 200, description: 'Orders have been successfully fetched' })
  async getAllCustomerOrganizationOrders(
    @Query('organizationId') organizationId: string,
    @Query() query: any,
  ) {
    const { cusOrders, metadata } =
      await this.customerOrganizationOrderService.fetchOrganizationCustomerOrdersPerCustomer(
        organizationId,
        query,
      );
    return {
      status: CallStatuses.Success,
      code: customerOrganizationOrderResponseCodes.Orders_Fetched,
      data: cusOrders,
      metadata,
    };
  }

  @Get('potential-order-info/:id')
  @ApiOperation({ summary: 'get potential order info' })
  @ApiResponse({ status: 200, description: 'Order info successfully fetched' })
  async fetchPotentialOrderInfo(@Param('id') id: string) {
    const orgPotentialorder =
      await this.customerOrganizationOrderService.fetchPotentialOrder(id);
    return {
      status: CallStatuses.Success,
      code: customerOrganizationOrderResponseCodes.Potenion_Order_Fetched,
      data: orgPotentialorder,
    };
  }

  @Get('organization')
  @ApiOperation({ summary: 'Get orders for an organization with filters' })
  @ApiResponse({ status: 200, description: 'Orders have been successfully fetched' })
  async getAllOrders(
    @Query('organizationId') organizationId: string,
    @Query() query: any,
  ) {
    const { orders, metadata } =
      await this.customerOrganizationOrderService.fetchOrganizationCustomerOrders(
        organizationId,
        query,
      );
    const ordersWithCustomerName = orders.map((order: any) => {
      return {
        ...order,
        customerName: order.customer?.name || 'Customer',
      };
    });
    return {
      status: CallStatuses.Success,
      code: customerOrganizationOrderResponseCodes.Orders_Fetched,
      data: ordersWithCustomerName,
      metadata,
    };
  }

  @Post('update')
  @ApiOperation({ summary: 'update order for an organization' })
  @ApiResponse({ status: 201, description: 'Orders have been successfully updated' })
  @UsePipes(new JoiValidationPipe(UpdateOrderStatusSchema))
  async updateOrder(
    @Body() updateOrderDto: { status: string; orderId: string; organizationId?: string },
  ) {
    const orgOrder =
      await this.customerOrganizationOrderService.handleUpdateCustomerOrganizationOrder(
        { status: updateOrderDto.status, orderId: updateOrderDto.orderId } as any,
        { sub: updateOrderDto.organizationId } as any,
      );
    return {
      status: CallStatuses.Success,
      code: customerOrganizationOrderResponseCodes.Order_Updated,
      data: orgOrder,
    };
  }
}
