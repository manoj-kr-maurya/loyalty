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
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CallStatuses } from 'src/common/enums/status-codes';
import { CustomerOrganizationOrderService } from './customer-organization-order.service';
import {
  CreateCustomerOrganizationOrderDto,
  FetchCustomerOrdersForCustomerQueryParams,
  FetchCustomerOrdersForOrganizationQueryParams,
  UpdateCustomerOrganizationOrderDto,
} from './DTO/customerOrganizationOrder.dto';
import { customerOrganizationOrderResponseCodes } from './enums/responseCodes';
import {
  RequestWithJWTTokenPayloadAndToken,
  JwtTokenPayload,
} from '../auth/DTO/jwt.dto';
import { VerifyJWTAndFetchPayload } from 'src/interceptors/auth/verify-jwt-and-fetch-payload';

@ApiTags('Customer-Organization-Orders')
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
  @ApiBody({ type: CreateCustomerOrganizationOrderDto })
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async createOrder(
    @Body() createOrderDto: CreateCustomerOrganizationOrderDto,
    @Req() request: RequestWithJWTTokenPayloadAndToken,
  ) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;

    // Wait for the promise to resolve after the delay and then continue
    const orgOrder =
      await this.customerOrganizationOrderService.createCustomerOrganizationOrder(
        jwtTokenPayload.sub,
        createOrderDto,
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
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async getAllCustomerOrganizationOrders(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Query() query: FetchCustomerOrdersForCustomerQueryParams,
  ) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;

    // Wait for the promise to resolve after the delay and then continue
    const { cusOrders, metadata } =
      await this.customerOrganizationOrderService.fetchOrganizationCustomerOrdersPerCustomer(
        jwtTokenPayload.sub,
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
  @ApiOperation({ summary: 'get orders for a customer to organization' })
  @ApiResponse({
    status: 200,
    description: 'Orders have been successfully fetched',
  })
  @UseInterceptors(VerifyJWTAndFetchPayload)
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
  @ApiResponse({
    status: 200,
    description: 'Orders have been successfully fetched',
  })
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async getAllOrders(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Query() query: FetchCustomerOrdersForOrganizationQueryParams,
  ) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;

    // Fetch orders with pagination and filters
    const { orders, metadata } =
      await this.customerOrganizationOrderService.fetchOrganizationCustomerOrders(
        jwtTokenPayload.sub,
        query,
      );

    // Add customer name to each order in the response
    const ordersWithCustomerName = orders.map((order) => {
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
  @ApiOperation({ summary: 'update order for a organization' })
  @ApiResponse({
    status: 201,
    description: 'Orders have been successfully updated',
  })
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async updateOrder(
    @Body() updateOrderDto: UpdateCustomerOrganizationOrderDto,
  ) {
    // Wait for the promise to resolve after the delay and then continue
    const orgOrder =
      await this.customerOrganizationOrderService.handleUpdateCustomerOrganizationOrder(
        updateOrderDto,
      );

    return {
      status: CallStatuses.Success,
      code: customerOrganizationOrderResponseCodes.Order_Updated,
      data: orgOrder,
    };
  }
}
