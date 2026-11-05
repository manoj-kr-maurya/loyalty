import { Injectable } from '@nestjs/common';
import { OtpPhoneFindOrCreateCustomerForm } from './DTO/customer.dto';
import { Customer, MetaFlagsForCustomer, Prisma } from '@prisma/client';
import to from 'await-to-js';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

@Injectable()
export class CustomerPrismaHelperService {
  constructor(private prismaService: PrismaService) {}

  async findOrCreateCustomerByPhoneNumber(
    form: OtpPhoneFindOrCreateCustomerForm,
    organizationId: string,
  ): Promise<Customer> {
    const [error, existingCustomer] = await to(
      this.findCustomerForOrganization({
        organizationId,
        phoneNumber: form.phoneNumber,
      }),
    );

    if (existingCustomer && !error) {
      return existingCustomer;
    }
    const createCustomerPayload: Prisma.CustomerCreateInput = {
      phoneNumber: form.phoneNumber,
      countryCode: form.countryCode,
      name: form.name,
      organization: { connect: { id: organizationId } },
      metaFlags: {
        create: this.getDefaultMetaFlagsForCus(),
      },
    };
    const createdCustomer = await this.prismaService.customer.create({
      data: createCustomerPayload,
    });
    return createdCustomer;
  }

  /**
   * Resolves the customer of a single tenant. The same phone number may
   * exist at more than one tenant, each one a separate customer.
   */
  async findCustomerForOrganization({
    organizationId,
    phoneNumber,
  }: {
    organizationId: string;
    phoneNumber: string;
  }): Promise<Customer> {
    return await this.prismaService.customer.findFirstOrThrow({
      where: { organizationId, phoneNumber },
      include: { metaFlags: true },
    });
  }

  async findCustomerByExternalId(
    organizationId: string,
    externalId: string,
  ): Promise<Customer> {
    return await this.prismaService.customer.findFirstOrThrow({
      where: { organizationId, externalId },
      include: { metaFlags: true },
    });
  }

  async createCustomerForOrganization(form: {
    organizationId: string;
    phoneNumber: string;
    externalId?: string;
    countryCode: string;
    name?: string;
  }): Promise<Customer> {
    return await this.prismaService.customer.create({
      data: {
        organization: { connect: { id: form.organizationId } },
        phoneNumber: form.phoneNumber,
        countryCode: form.countryCode,
        ...(form.externalId ? { externalId: form.externalId } : {}),
        ...(form.name ? { name: form.name } : {}),
        metaFlags: { create: this.getDefaultMetaFlagsForCus() },
      },
    });
  }

  /**
   * A customer belongs to an organization when their `organizationId` matches.
   * Throws a 404 (not 403) so callers cannot use the endpoint to enumerate
   * customer ids across tenants.
   */
  async assertCustomerBelongsToOrganization(
    customerId: string | undefined,
    organizationId: string,
  ): Promise<void> {
    if (!customerId) {
      throw new CommonException(
        'customerId is required',
        StatusCodes.BAD_REQUEST,
      );
    }

    const customer = await this.prismaService.customer.findFirst({
      where: { id: customerId, organizationId },
      select: { id: true },
    });

    if (customer) return;

    throw new CommonException(
      'Customer not found in organization',
      StatusCodes.NOT_FOUND,
    );
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

  /**
   * Loads a customer together with their wallet balances.
   * The wallet relation is scoped to a single organization so a tenant can
   * never observe the balances it holds for a customer at another tenant.
   */
  async findCustomerWithWalletBalances(
    where: Prisma.CustomerWhereUniqueInput,
    organizationId: string,
  ) {
    return await this.prismaService.customer.findFirstOrThrow({
      where,
      include: {
        customerWallet: {
          where: { organizationId },
        },
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
  async getTopCustomersForLeaderBoard(interval = 24, organizationId?: string) {
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
      coo."createdAt" >= NOW() - (${interval} * INTERVAL '1 hour')
      AND coo.status = 'COMPLETED'
      AND (${organizationId ?? null}::text IS NULL OR coo."organizationId" = ${
      organizationId ?? null
    })
    GROUP BY
      coo."customerId", c."name", c."phoneNumber"
    ORDER BY
      total_earned DESC
    LIMIT 10;
  `;
  }
}
