/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import {
  CurrencyBucket,
  Prisma,
  Organization,
  MetaFlagsForOrganization,
  Currency,
} from '@prisma/client';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';
import { getPaginationMetadata } from 'src/common/utils/pagination.util';

@Injectable()
export class OrganizationPrismaHelperService {
  constructor(private readonly prismaService: PrismaService) {}

  async findCurrencyBucket(
    where: Prisma.CurrencyBucketWhereUniqueInput,
  ): Promise<CurrencyBucket> {
    return await this.prismaService.currencyBucket.findUniqueOrThrow({
      where,
    });
  }

  async createCurrencyBucket(
    form: Prisma.CurrencyBucketCreateInput,
  ): Promise<CurrencyBucket> {
    return await this.prismaService.currencyBucket.create({ data: form });
  }

  async getCurrencyBucketAndItsRelations(
    where: Prisma.CurrencyBucketWhereUniqueInput,
  ): Promise<CurrencyBucket & { organization: Organization }> {
    return await this.prismaService.currencyBucket.findUnique({
      where,
      include: {
        organization: true,
      },
    });
  }

  async updateCurrencyBucket(
    newCurrencyBucket: Prisma.CurrencyBucketUpdateInput,
    where: Prisma.CurrencyBucketWhereUniqueInput,
  ): Promise<CurrencyBucket> {
    return await this.prismaService.currencyBucket.update({
      where,
      data: newCurrencyBucket,
    });
  }

  async deleteCurrencyBucket(
    where: Prisma.CurrencyBucketWhereUniqueInput,
  ): Promise<CurrencyBucket> {
    return await this.prismaService.currencyBucket.delete({
      where,
    });
  }

  async findOrganization(where: Prisma.OrganizationWhereUniqueInput) {
    return await this.prismaService.organization.findFirstOrThrow({
      where: { ...where },
    });
  }

  async findOrganizationByUsername(username: string) {
    return await this.prismaService.organization.findFirst({
      where: { username },
    });
  }

  async getOrganizationWithCampaignsAndMetaFlags(organizationId: string) {
    return await this.prismaService.organization.findFirstOrThrow({
      where: { id: organizationId },
      include: { campaigns: true, metaFlags: true },
    });
  }

  async getOrganizationWithCurrenciesAndCurrencyBuckets(
    organizationId: string,
  ) {
    return await this.prismaService.organization.findFirstOrThrow({
      where: { id: organizationId },
      include: { currencies: true, currencyBuckets: true },
    });
  }

  async createOrganization(
    form: Prisma.OrganizationCreateInput,
  ): Promise<Organization> {
    return await this.prismaService.organization.create({ data: form });
  }

  async getOrganizationAndItsManyRelations(
    where: Prisma.OrganizationWhereUniqueInput,
  ): Promise<
    Organization & {
      currencyBuckets: CurrencyBucket[];
      currencies: Currency[];
    }
  > {
    return await this.prismaService.organization.findUnique({
      where,
      include: { currencyBuckets: true, currencies: true },
    });
  }
  async createOrganizationCurrencyBucket(
    data: Prisma.CurrencyBucketCreateInput,
  ): Promise<CurrencyBucket> {
    return await this.prismaService.currencyBucket.create({ data });
  }

  async updateOrganization(
    newOrganization: Prisma.OrganizationUpdateInput,
    where: Prisma.OrganizationWhereUniqueInput,
  ): Promise<Organization> {
    return await this.prismaService.organization.update({
      where,
      data: newOrganization,
    });
  }

  async findMetaFlagsForOrganization(
    where: Prisma.MetaFlagsForOrganizationWhereUniqueInput,
  ): Promise<MetaFlagsForOrganization> {
    const existing =
      await this.prismaService.metaFlagsForOrganization.findUnique({ where });
    if (existing) return existing;

    if (!where.organizationId) {
      throw new CommonException(
        'Organization meta flags not found',
        StatusCodes.NOT_FOUND,
      );
    }

    return this.prismaService.metaFlagsForOrganization.create({
      data: { organizationId: where.organizationId },
    });
  }

  async getOrganizationsOfAnAdmin(
    where: Prisma.OrganizationWhereInput,
  ): Promise<Organization[]> {
    return await this.prismaService.organization.findMany({
      where,
    });
  }

  async createMetaFlagsForOrganization(
    data: Prisma.MetaFlagsForOrganizationCreateInput,
  ): Promise<MetaFlagsForOrganization> {
    return await this.prismaService.metaFlagsForOrganization.create({
      data,
    });
  }

  async updateMetaFlagsForOrganization(
    where: Prisma.MetaFlagsForOrganizationWhereUniqueInput,
    data: Prisma.MetaFlagsForOrganizationUpdateInput,
  ): Promise<MetaFlagsForOrganization> {
    return await this.prismaService.metaFlagsForOrganization.update({
      where,
      data,
    });
  }

  async deleteMetaFlagsForOrganization(
    where: Prisma.MetaFlagsForOrganizationWhereUniqueInput,
  ): Promise<MetaFlagsForOrganization> {
    return await this.prismaService.metaFlagsForOrganization.delete({
      where,
    });
  }
  async getTopOrganizationsForLeaderBoard(paginationQuery: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = paginationQuery;
    const skip = (page - 1) * limit;

    // Create a search condition for the SQL query
    const searchCondition = search
      ? Prisma.sql`AND o."name" ILIKE ${`%${search}%`}`
      : Prisma.sql``;

    // Perform parallel queries for organizations and total count
    const [organizations, countResult] = await Promise.all([
      this.prismaService.$queryRaw<
        Array<{
          id: string;
          name: string;
          logo: string | null;
          code: string;
          amount: number;
        }>
      >`
    SELECT 
      o."id" AS id,
      o."name" AS name,
      o."logoUrl" AS logo,
      cb."code" AS code,
      SUM(cb."distributedAmount")::FLOAT AS amount
    FROM 
      "organization" o
    INNER JOIN 
      "currencyBucket" cb 
      ON o.id = cb."organizationId"
    WHERE 
      o."role" = 'ADMIN'
      AND o."isSoftDeleted" = false
      ${searchCondition}
    GROUP BY 
      o.id, o."name", o."logoUrl", cb."code"
    ORDER BY 
      amount DESC
    LIMIT ${limit}
    OFFSET ${skip}
  `,
      this.prismaService.$queryRaw<[{ count: bigint }]>`
    SELECT 
      COUNT(DISTINCT o.id)::BIGINT AS count
    FROM 
      "organization" o
    INNER JOIN 
      "currencyBucket" cb 
      ON o.id = cb."organizationId"
    WHERE 
      o."role" = 'ADMIN'
      AND o."isSoftDeleted" = false
      ${searchCondition}
  `,
    ]);

    // Get the total count from the count query result
    const totalItems = Number(countResult[0]?.count || 0);

    // Generate pagination metadata
    const metadata = getPaginationMetadata(totalItems, page, limit);

    return {
      organizations,
      metadata,
    };
  }
}
