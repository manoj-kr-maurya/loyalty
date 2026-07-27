import { Injectable } from '@nestjs/common';
import { CreateOrderDto, UpdateOrderDto } from './DTO/organizationOrder.dto';
import {
  OrganizationOrder,
  OrganizationOrderStatus,
  OrganizationOrderType,
  Prisma,
} from '@prisma/client';
import { OrganizationOrderPrismaHelperService } from './organization-order-prisma-helper.service';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { getPaginationMetadata } from 'src/common/utils/pagination.util';

@Injectable()
export class OrganizationOrderService {
  constructor(
    private readonly commonUtilsService: CommonUtilsService,
    private readonly organizationOrderPrismaHelperService: OrganizationOrderPrismaHelperService,
  ) {}
  async createOrganizationOrder(
    organizationId: string,
    createOrderDto: CreateOrderDto,
    prismaTransaction?: Prisma.TransactionClient, // Optional prismaTransaction
  ): Promise<OrganizationOrder> {
    const transactionId =
      this.commonUtilsService.generateNewUniqueTransactionId('organization');

    // If prismaTransaction is passed, use it. Otherwise, fall back to the default service.
    const newOrder =
      await this.organizationOrderPrismaHelperService.createOrganizationOrder(
        {
          orderType: OrganizationOrderType.CURRENCY_PURCHASE,
          transactionId,
          amount: createOrderDto.amount,
          orderStatus: OrganizationOrderStatus.PENDING,
          organization: { connect: { id: organizationId } },
          statusHistory: {
            create: [
              {
                status: OrganizationOrderStatus.PENDING,
                timestamp: new Date(), // Add initial status history
              },
            ],
          },
          details: { create: createOrderDto.details },
        },
        prismaTransaction,
      ); // Pass the prismaTransaction to the service method if provided

    return newOrder;
  }

  async fetchOrganizationOrders(
    organizationId: string,
    query: PaginationQueryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const orderBy = { createdAt: 'desc' as const };

    // Perform parallel queries for orders and total count
    const [orgOrders, totalItems] = await Promise.all([
      this.organizationOrderPrismaHelperService.findOrganizationOrders(
        {
          organizationId: organizationId,
        },
        orderBy,
        limit,
        skip,
      ),
      this.organizationOrderPrismaHelperService.countOrganizationOrders({
        organizationId: organizationId,
      }),
    ]);

    // Generate pagination metadata
    const metadata = getPaginationMetadata(totalItems, page, limit);

    return {
      orgOrders,
      metadata,
    };
  }

  async getOrganizationOrder(orderId: string) {
    const orgOrder =
      await this.organizationOrderPrismaHelperService.findOrganizationOrder({
        id: orderId,
      });
    return orgOrder;
  }

  async updateOrganizationOrder(
    orderId: string,
    updateOrderDto: UpdateOrderDto,
    prismaTransaction?: Prisma.TransactionClient, // Optional prismaTransaction
  ): Promise<OrganizationOrder> {
    const statusHistory = {
      status: updateOrderDto.newStatus,
      timestamp: new Date(),
    };

    // If prismaTransaction is passed, use it; otherwise, fall back to default service
    const updatedOrder =
      await this.organizationOrderPrismaHelperService.updateOrganizationOrder(
        { id: orderId },
        {
          orderStatus: updateOrderDto.newStatus,
          statusHistory: { create: statusHistory },
        },
        prismaTransaction, // Pass prismaTransaction to the service method if provided
      );

    return updatedOrder;
  }
}
