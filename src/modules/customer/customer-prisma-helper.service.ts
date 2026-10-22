import { Injectable } from '@nestjs/common';
import { OtpPhoneFindOrCreateCustomerForm } from './DTO/customer.dto';
import { Customer, MetaFlagsForCustomer, Prisma } from '@prisma/client';
import to from 'await-to-js';
import { PrismaService } from 'src/common/services/prismaService';

@Injectable()
export class CustomerPrismaHelperService {
  constructor(private prismaService: PrismaService) {}

  async findOrCreateCustomerByPhoneNumber(
    form: OtpPhoneFindOrCreateCustomerForm,
  ): Promise<Customer> {
    const [error, existingCustomer] = await to(
      this.findCustomer({ phoneNumber: form.phoneNumber }),
    );

    if (existingCustomer && !error) {
      return existingCustomer;
    }
    const createCustomerPayload: Prisma.CustomerCreateInput = {
      phoneNumber: form.phoneNumber,
      countryCode: form.countryCode,
      name: form.name,
      metaFlags: {
        create: this.getDefaultMetaFlagsForCus(),
      },
    };
    const createdCustomer = await this.prismaService.customer.create({
      data: createCustomerPayload,
    });
    return createdCustomer;
  }

  async findCustomer(where: Prisma.CustomerWhereUniqueInput) {
    return await this.prismaService.customer.findFirstOrThrow({
      where,
      include: {
        metaFlags: true,
      },
    });
  }

  async findCustomerWithoutNestedData(where: Prisma.CustomerWhereUniqueInput) {
    return await this.prismaService.customer.findFirstOrThrow({
      where,
    });
  }

  async findCustomerWithWalletBalances(where: Prisma.CustomerWhereUniqueInput) {
    return await this.prismaService.customer.findFirstOrThrow({
      where,
      include: {
        customerWallet: true,
      },
    });
  }

  async createCustomer(form: Prisma.CustomerCreateInput): Promise<Customer> {
    return await this.prismaService.customer.create({ data: form });
  }

  async updateCustomer(
    newCustomer: Prisma.CustomerUpdateInput,
    where: Prisma.CustomerWhereUniqueInput,
  ): Promise<Customer> {
    return await this.prismaService.customer.update({
      where,
      data: newCustomer,
    });
  }

  private getDefaultMetaFlagsForCus() {
    return {
      initJourneyCompleted: true,
    };
  }

  async findMetaFlagsForCustomer(
    where: Prisma.MetaFlagsForCustomerWhereUniqueInput,
  ): Promise<MetaFlagsForCustomer> {
    return await this.prismaService.metaFlagsForCustomer.findUniqueOrThrow({
      where,
    });
  }

  async createMetaFlagsForCustomer(
    data: Prisma.MetaFlagsForCustomerCreateInput,
  ): Promise<MetaFlagsForCustomer> {
    return await this.prismaService.metaFlagsForCustomer.create({
      data,
    });
  }

  async updateMetaFlagsForCustomer(
    where: Prisma.MetaFlagsForCustomerWhereUniqueInput,
    data: Prisma.MetaFlagsForCustomerUpdateInput,
  ): Promise<MetaFlagsForCustomer> {
    return await this.prismaService.metaFlagsForCustomer.update({
      where,
      data,
    });
  }

  async deleteMetaFlagsForCustomer(
    where: Prisma.MetaFlagsForCustomerWhereUniqueInput,
  ): Promise<MetaFlagsForCustomer> {
    return await this.prismaService.metaFlagsForCustomer.delete({
      where,
    });
  }

  /**
   * Get top customers for leaderboard
   * @param interval - Time interval in hours (default: 24)
   * @returns Array of customers with their total earned amount
   */
  async getTopCustomersForLeaderBoard(interval = 24) {
    return this.prismaService.$queryRaw<
      Array<{
        customer_name: string;
        total_earned: number;
      }>
    >`
    SELECT
      c."name" AS customer_name,
      SUM(ecad.amount)::FLOAT AS total_earned
    FROM
      "customerOrganizationOrder" coo
    INNER JOIN
      "customerEarningAmountDetail" cead 
      ON coo.id = cead."customerOrganizationOrderId"
    INNER JOIN
      "earningCoinAmountDetail" ecad 
      ON ecad."customerEarningAmountDetailId" = cead.id
    INNER JOIN
      "customer" c 
      ON coo."customerId" = c.id
    WHERE
      coo."createdAt" >= NOW() - INTERVAL '240 HOURS'
      AND coo.status = 'COMPLETED'
    GROUP BY
      coo."customerId", c."name", c."phoneNumber"
    ORDER BY
      total_earned DESC
    LIMIT 10;
  `;
  }
}
