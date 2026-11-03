import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CallStatuses } from 'src/common/enums/status-codes';
import { CustomerOrganizationOrderService } from './customer-organization-order.service';
import {
  CreateOrderSchema,
  UpdateOrderStatusSchema,
} from './DTO/customerOrganizationOrder.dto';
import { customerOrganizationOrderResponseCodes } from './enums/responseCodes';
import { OrganizationApiKeyGuard } from 'src/modules/auth/guards/organization-api-key.guard';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';
import { CurrentAuth } from 'src/modules/auth/decorators/current-auth.decorator';
import { OrganizationAuthContext } from 'src/modules/auth/api-key.service';
import { resolveOrganizationId } from 'src/modules/auth/resolve-organization-id';
import { UserTypes } from 'src/common/enums/user-types';

@ApiTags('Customer-Organization-Orders')
@ApiSecurity('x-api-key')
@UseGuards(OrganizationApiKeyGuard)
@Controller('customer-organization/order')
export class CustomerOrganizationOrderController {
  constructor(
    private readonly customerOrganizationOrderService: CustomerOrganizationOrderService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an order for a customer to organization' })
  @ApiResponse({
    status: 201,
    description: 'The order has been successfully created.',
  })
  @UsePipes(new JoiValidationPipe(CreateOrderSchema))
  async createOrder(
    @Body()
    createOrderDto: {
      customerId: string;
      organizationId: string;
      burningAmountDetails: any;
      details?: any;
      idempotencyKey?: string;
    },
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const { customerId, organizationId, ...data } = createOrderDto;
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    const orgOrder =
      await this.customerOrganizationOrderService.createCustomerOrganizationOrder(
        customerId,
        { ...data, organizationId: effectiveOrganizationId } as any,
      );
    return {
      status: CallStatuses.Success,
      code: customerOrganizationOrderResponseCodes.Order_Created,
      data: orgOrder,
    };
  }

  @Get('customer')
  @ApiOperation({ summary: 'get orders for a customer to organization' })
  @ApiResponse({
    status: 200,
    description: 'Orders have been successfully fetched',
  })
  async getAllCustomerOrganizationOrders(
    @Query('customerId') customerId: string,
    @Query('organizationId') organizationId: string,
    @Query() query: any,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    if (!customerId) {
      throw new BadRequestException('customerId is required');
    }
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    const { cusOrders, metadata } =
      await this.customerOrganizationOrderService.fetchOrganizationCustomerOrdersPerCustomer(
        customerId,
        effectiveOrganizationId,
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
  async fetchPotentialOrderInfo(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    const orgPotentialorder =
      await this.customerOrganizationOrderService.fetchPotentialOrder(
        id,
        effectiveOrganizationId,
      );
    return {
      status: CallStatuses.Success,
      code: customerOrganizationOrderResponseCodes.Potenion_Order_Fetched,
      data: orgPotentialorder,
    };
  }

  @Get('organization')
  @ApiOperation({ summary: 'Get orders for an organization with filters' })
  @ApiResponse({
    status: 200,
    description: 'Orders have been successfully fetched',
  })
  async getAllOrders(
    @Query('organizationId') organizationId: string,
    @Query() query: any,
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const effectiveOrganizationId = resolveOrganizationId(auth, organizationId);
    const { orders, metadata } =
      await this.customerOrganizationOrderService.fetchOrganizationCustomerOrders(
        effectiveOrganizationId,
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
  @ApiResponse({
    status: 201,
    description: 'Orders have been successfully updated',
  })
  @UsePipes(new JoiValidationPipe(UpdateOrderStatusSchema))
  async updateOrder(
    @Body()
    updateOrderDto: {
      status: string;
      orderId: string;
      organizationId?: string;
    },
    @CurrentAuth() auth: OrganizationAuthContext,
  ) {
    const organizationId = resolveOrganizationId(
      auth,
      updateOrderDto.organizationId,
    );
    const orgOrder =
      await this.customerOrganizationOrderService.handleUpdateCustomerOrganizationOrder(
        {
          status: updateOrderDto.status,
          orderId: updateOrderDto.orderId,
        } as any,
        { sub: organizationId, tokenType: UserTypes.organization } as any,
      );
    return {
      status: CallStatuses.Success,
      code: customerOrganizationOrderResponseCodes.Order_Updated,
      data: orgOrder,
    };
  }
}
