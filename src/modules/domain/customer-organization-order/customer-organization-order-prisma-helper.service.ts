import { Injectable } from '@nestjs/common';
import {
  BurningCashAmountDetail,
  BurningCoinAmountDetail,
  CustomerBurningAmountDetail,
  CustomerEarningAmountDetail,
  CustomerOrganizationOrder,
  EarningCoinAmountDetail,
  Prisma,
  CustomerOrganizationOrderStatusHistory,
} from '@prisma/client';
import { PrismaService } from 'src/common/services/prismaService';

export type CustomerOrganizationOrderWithDetails =
  Prisma.CustomerOrganizationOrderGetPayload<{
    include: {
      customerBurningAmountDetail: {
        include: {
          cash: true;
          coin: true;
        };
      };
      customerEarningAmountDetail: {
        include: {
          coin: true;
        };
      };
      statusHistory: true;
      customer: true;
      organization: true;
    };
  }>;
@Injectable()
export class CustomerOrganizationOrderPrismaHelperService {
  constructor(private readonly prismaService: PrismaService) {}

  private getPrismaService(customPrismaService?: PrismaService): PrismaService {
    return customPrismaService || this.prismaService;
  }

  async createCustomerOrganizationOrder(
    form: Prisma.CustomerOrganizationOrderCreateInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerOrganizationOrder> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerOrganizationOrder.create({
      data: form,
    });
  }

  async findCustomerOrganizationOrder(
    where: Prisma.CustomerOrganizationOrderWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerOrganizationOrder> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerOrganizationOrder.findFirstOrThrow({
      where,
      include: {
        customerBurningAmountDetail: {
          include: {
            cash: true, // BurningCashAmountDetail
            coin: true, // BurningCoinAmountDetail
          },
        },
        customerEarningAmountDetail: {
          include: {
            coin: true, // EarningCoinAmountDetail
          },
        },
      },
    });
  }

  async countCustomerOrganizationOrders(
    where: Prisma.CustomerOrganizationOrderWhereInput,
    customPrismaService?: PrismaService,
  ) {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerOrganizationOrder.count({
      where,
    });
  }

  async findCustomerOrganizationOrderWithAllNestedDetails(
    where: Prisma.CustomerOrganizationOrderWhereUniqueInput,
    customPrismaService?: PrismaService,
  ) {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerOrganizationOrder.findFirstOrThrow({
      where,
      include: {
        customerBurningAmountDetail: {
          include: {
            cash: true, // BurningCashAmountDetail
            coin: true, // BurningCoinAmountDetail
          },
        },
        customerEarningAmountDetail: {
          include: {
            coin: true, // EarningCoinAmountDetail
          },
        },
        statusHistory: true, // CustomerOrganizationOrderStatusHistory
        customer: true, // Fetch associated Customer
        organization: true, // Fetch associated Organization
      },
    });
  }

  async findCustomerOrganizationOrders(
    where: Prisma.CustomerOrganizationOrderWhereInput,
    sort?: Prisma.CustomerOrganizationOrderOrderByWithRelationInput,
    take?: number,
    skip?: number,
    customPrismaService?: PrismaService,
  ) {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerOrganizationOrder.findMany({
      where,
      include: {
        customerBurningAmountDetail: {
          include: {
            cash: true, // BurningCashAmountDetail
            coin: true, // BurningCoinAmountDetail
          },
        },
        customerEarningAmountDetail: {
          include: {
            coin: true, // EarningCoinAmountDetail
          },
        },
        statusHistory: true, // CustomerOrganizationOrderStatusHistory
        organization: {
          select: {
            name: true,
            logoUrl: true,
          },
        },
        customer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: sort,
      take, // Limit the number of results
      skip, // Skip a number of results
    });
  }

  async updateCustomerOrganizationOrder(
    where: Prisma.CustomerOrganizationOrderWhereUniqueInput,
    form: Prisma.CustomerOrganizationOrderUpdateInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerOrganizationOrder> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerOrganizationOrder.update({
      where,
      data: form,
    });
  }

  async createStatusHistory(
    data: Prisma.CustomerOrganizationOrderStatusHistoryCreateInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerOrganizationOrderStatusHistory> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerOrganizationOrderStatusHistory.create({
      data,
    });
  }

  async findStatusHistory(
    where: Prisma.CustomerOrganizationOrderStatusHistoryWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerOrganizationOrderStatusHistory> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerOrganizationOrderStatusHistory.findUniqueOrThrow(
      {
        where,
      },
    );
  }

  async updateStatusHistory(
    data: Prisma.CustomerOrganizationOrderStatusHistoryUpdateInput,
    where: Prisma.CustomerOrganizationOrderStatusHistoryWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerOrganizationOrderStatusHistory> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerOrganizationOrderStatusHistory.update({
      where,
      data,
    });
  }

  async deleteStatusHistory(
    where: Prisma.CustomerOrganizationOrderStatusHistoryWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerOrganizationOrderStatusHistory> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerOrganizationOrderStatusHistory.delete({
      where,
    });
  }

  async createEarningCoinAmountDetails(
    data: Prisma.EarningCoinAmountDetailCreateInput,
    customPrismaService?: PrismaService,
  ): Promise<EarningCoinAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.earningCoinAmountDetail.create({ data });
  }

  async findEarningCoinAmountDetails(
    where: Prisma.EarningCoinAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<EarningCoinAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.earningCoinAmountDetail.findUniqueOrThrow({
      where,
    });
  }

  async updateEarningCoinAmountDetails(
    data: Prisma.EarningCoinAmountDetailUpdateInput,
    where: Prisma.EarningCoinAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<EarningCoinAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.earningCoinAmountDetail.update({
      where,
      data,
    });
  }

  async deleteEarningCoinAmountDetails(
    where: Prisma.EarningCoinAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<EarningCoinAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.earningCoinAmountDetail.delete({
      where,
    });
  }

  async createCustomerEarningAmountDetail(
    data: Prisma.CustomerEarningAmountDetailCreateInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerEarningAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerEarningAmountDetail.create({
      data,
    });
  }

  async findCustomerEarningAmountDetail(
    where: Prisma.CustomerEarningAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerEarningAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerEarningAmountDetail.findUniqueOrThrow({
      where,
    });
  }

  async updateCustomerEarningAmountDetail(
    data: Prisma.CustomerEarningAmountDetailUpdateInput,
    where: Prisma.CustomerEarningAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerEarningAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerEarningAmountDetail.update({
      where,
      data,
    });
  }

  async deleteCustomerEarningAmountDetail(
    where: Prisma.CustomerEarningAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerEarningAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerEarningAmountDetail.delete({
      where,
    });
  }

  async createBurningCoinAmountDetails(
    data: Prisma.BurningCoinAmountDetailCreateInput,
    customPrismaService?: PrismaService,
  ): Promise<BurningCoinAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.burningCoinAmountDetail.create({ data });
  }

  async findBurningCoinAmountDetails(
    where: Prisma.BurningCoinAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<BurningCoinAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.burningCoinAmountDetail.findUniqueOrThrow({
      where,
    });
  }

  async updateBurningCoinAmountDetails(
    data: Prisma.BurningCoinAmountDetailUpdateInput,
    where: Prisma.BurningCoinAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<BurningCoinAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.burningCoinAmountDetail.update({
      where,
      data,
    });
  }

  async deleteBurningCoinAmountDetails(
    where: Prisma.BurningCoinAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<BurningCoinAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.burningCoinAmountDetail.delete({
      where,
    });
  }

  async createBurningCashAmountDetails(
    data: Prisma.BurningCashAmountDetailCreateInput,
    customPrismaService?: PrismaService,
  ): Promise<BurningCashAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.burningCashAmountDetail.create({ data });
  }

  async findBurningCashAmountDetails(
    where: Prisma.BurningCashAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<BurningCashAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.burningCashAmountDetail.findUniqueOrThrow({
      where,
    });
  }

  async updateBurningCashAmountDetails(
    data: Prisma.BurningCashAmountDetailUpdateInput,
    where: Prisma.BurningCashAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<BurningCashAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.burningCashAmountDetail.update({
      where,
      data,
    });
  }

  async deleteBurningCashAmountDetails(
    where: Prisma.BurningCashAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<BurningCashAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.burningCashAmountDetail.delete({
      where,
    });
  }

  async createCustomerBurningAmountDetail(
    data: Prisma.CustomerBurningAmountDetailCreateInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerBurningAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerBurningAmountDetail.create({
      data,
    });
  }

  async findCustomerBurningAmountDetail(
    where: Prisma.CustomerBurningAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerBurningAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerBurningAmountDetail.findUniqueOrThrow({
      where,
    });
  }

  async updateCustomerBurningAmountDetail(
    data: Prisma.CustomerBurningAmountDetailUpdateInput,
    where: Prisma.CustomerBurningAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerBurningAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerBurningAmountDetail.update({
      where,
      data,
    });
  }

  async deleteCustomerBurningAmountDetail(
    where: Prisma.CustomerBurningAmountDetailWhereUniqueInput,
    customPrismaService?: PrismaService,
  ): Promise<CustomerBurningAmountDetail> {
    const prisma = this.getPrismaService(customPrismaService);
    return await prisma.customerBurningAmountDetail.delete({
      where,
    });
  }
}
