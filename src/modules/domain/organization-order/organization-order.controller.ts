import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation, ApiBody } from '@nestjs/swagger';
import { OrganizationOrderService } from './organization-order.service';
import { CreateOrderDto, UpdateOrderDto } from './DTO/organizationOrder.dto';
import { organizationOrderResponseCodes } from './enums/responseCodes';
import { CallStatuses } from 'src/common/enums/status-codes';
import {
  RequestWithJWTTokenPayloadAndToken,
  JwtTokenPayload,
} from '../auth/DTO/jwt.dto';
import { VerifyJWTAndFetchPayload } from 'src/interceptors/auth/verify-jwt-and-fetch-payload';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

@ApiTags('Organization-Orders')
@Controller('organization/order')
export class OrganizationOrderController {
  constructor(
    private readonly organizationOrderService: OrganizationOrderService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an order for an organization' })
  @ApiResponse({
    status: 201,
    description: 'The order has been successfully created.',
  })
  @ApiBody({ type: CreateOrderDto })
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Req() request: RequestWithJWTTokenPayloadAndToken,
  ) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;

    // Wait for the promise to resolve after the delay and then continue
    const orgOrder =
      await this.organizationOrderService.createOrganizationOrder(
        jwtTokenPayload.sub,
        createOrderDto,
      );

    return {
      status: CallStatuses.Success,
      code: organizationOrderResponseCodes.Order_Created,
      data: orgOrder,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get orders for an organization' })
  @ApiResponse({
    status: 200,
    description: 'List of orders retrieved successfully.',
  })
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async getOrders(
    @Req() request: RequestWithJWTTokenPayloadAndToken,
    @Query() query: PaginationQueryDto,
  ) {
    const jwtTokenPayload: JwtTokenPayload = request.tokenPayload;

    const { orgOrders, metadata } =
      await this.organizationOrderService.fetchOrganizationOrders(
        jwtTokenPayload.sub,
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
  @ApiBody({ type: UpdateOrderDto })
  @UseInterceptors(VerifyJWTAndFetchPayload)
  update(
    @Param('orderId') orderId: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    // return this.organizationOrderService.update(
    //   organizationId,
    //   orderId,
    //   updateOrderDto,
    // );
  }
}
