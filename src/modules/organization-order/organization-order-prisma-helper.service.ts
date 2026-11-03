import { Injectable } from '@nestjs/common';
import {
  OrderDetails,
  OrganizationOrder,
  Prisma,
  OrganizationOrderStatusHistory,
} from '@prisma/client';
import { PrismaService } from 'src/common/services/prismaService';

@Injectable()
export class OrganizationOrderPrismaHelperService {
  constructor(private readonly prismaService: PrismaService) {}

  async createOrganizationOrder(
    form: Prisma.OrganizationOrderCreateInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrganizationOrder> {
    return await prismaClient.organizationOrder.create({ data: form });
  }

  async findOrganizationOrder(
    where: Prisma.OrganizationOrderWhereUniqueInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrganizationOrder> {
    return await prismaClient.organizationOrder.findFirstOrThrow({
      where,
    });
  }

  async findOrganizationOrders(
    where: Prisma.OrganizationOrderWhereInput,
    sort?: Prisma.OrganizationOrderOrderByWithRelationInput,
    take?: number, // Add take parameter for pagination
    skip?: number, // Add skip parameter for pagination
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrganizationOrder[]> {
    return await prismaClient.organizationOrder.findMany({
      where,
      include: { details: true },
      orderBy: sort,
      take, // Limit the number of results
      skip, // Skip a number of results
    });
  }

  async countOrganizationOrders(
    where: Prisma.OrganizationOrderWhereInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ) {
    return await prismaClient.organizationOrder.count({
      where,
    });
  }

  async updateOrganizationOrder(
    where: Prisma.OrganizationOrderWhereUniqueInput,
    data: Prisma.OrganizationOrderUpdateInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrganizationOrder> {
    return await prismaClient.organizationOrder.update({ where, data });
  }

  async findOneOrganizationOrderStatusHistory(
    where: Prisma.OrganizationOrderStatusHistoryWhereUniqueInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrganizationOrderStatusHistory | null> {
    return prismaClient.organizationOrderStatusHistory.findUnique({
      where,
    });
  }

  async findAllOrganizationOrderStatusHistory(
    where?: Prisma.OrganizationOrderStatusHistoryWhereInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrganizationOrderStatusHistory[]> {
    return prismaClient.organizationOrderStatusHistory.findMany({
      where,
    });
  }

  async createOrganizationOrderStatusHistory(
    data: Prisma.OrganizationOrderStatusHistoryCreateInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrganizationOrderStatusHistory> {
    return prismaClient.organizationOrderStatusHistory.create({
      data,
    });
  }

  async updateOrganizationOrderStatusHistory(
    where: Prisma.OrganizationOrderStatusHistoryWhereUniqueInput,
    data: Prisma.OrganizationOrderStatusHistoryUpdateInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrganizationOrderStatusHistory> {
    return prismaClient.organizationOrderStatusHistory.update({
      where,
      data,
    });
  }

  async deleteOrganizationOrderStatusHistory(
    where: Prisma.OrganizationOrderStatusHistoryWhereUniqueInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrganizationOrderStatusHistory> {
    return prismaClient.organizationOrderStatusHistory.delete({
      where,
    });
  }

  async findOneOrganizationOrderDetail(
    where: Prisma.OrderDetailsWhereUniqueInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrderDetails | null> {
    return prismaClient.orderDetails.findUnique({ where });
  }

  async findAllOrganizationOrderDetail(
    where?: Prisma.OrderDetailsWhereInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrderDetails[]> {
    return prismaClient.orderDetails.findMany({ where });
  }

  async createOrganizationOrderDetail(
    data: Prisma.OrderDetailsCreateInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrderDetails> {
    return prismaClient.orderDetails.create({ data });
  }

  async updateOrganizationOrderDetail(
    where: Prisma.OrderDetailsWhereUniqueInput,
    data: Prisma.OrderDetailsUpdateInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrderDetails> {
    return prismaClient.orderDetails.update({ where, data });
  }

  async deleteOrganizationOrderDetail(
    where: Prisma.OrderDetailsWhereUniqueInput,
    prismaClient: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<OrderDetails> {
    return prismaClient.orderDetails.delete({ where });
  }
}
