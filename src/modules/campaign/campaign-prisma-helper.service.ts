import { Injectable } from '@nestjs/common';
import {
  Currency,
  ExchangeRate,
  MetaFlagsForOrganization,
  OrganizationCampaign,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

@Injectable()
export class CampaignPrismaHelperService {
  constructor(private prismaService: PrismaService) {}

  async findExchangeRate(
    where: Prisma.ExchangeRateWhereUniqueInput,
  ): Promise<ExchangeRate> {
    return await this.prismaService.exchangeRate.findUniqueOrThrow({
      where,
    });
  }

  async createExchangeRate(
    form: Prisma.ExchangeRateCreateInput,
  ): Promise<ExchangeRate> {
    return await this.prismaService.exchangeRate.create({ data: form });
  }

  async getExchangeRateAndCurrency(
    where: Prisma.ExchangeRateWhereUniqueInput,
  ): Promise<ExchangeRate & { currency: Currency }> {
    return await this.prismaService.exchangeRate.findUnique({
      where,
      include: { currency: true },
    });
  }

  async updateExchangeRate(
    newExchangeRate: Prisma.ExchangeRateUpdateInput,
    where: Prisma.ExchangeRateWhereUniqueInput,
  ): Promise<ExchangeRate> {
    return await this.prismaService.exchangeRate.update({
      where,
      data: newExchangeRate,
    });
  }

  async deleteExchangeRate(
    where: Prisma.ExchangeRateWhereUniqueInput,
  ): Promise<ExchangeRate> {
    return await this.prismaService.exchangeRate.delete({
      where,
    });
  }

  async getAll(): Promise<OrganizationCampaign[]> {
    return await this.prismaService.organizationCampaign.findMany();
  }

  async createCampaign(
    form: Prisma.OrganizationCampaignCreateInput,
  ): Promise<OrganizationCampaign> {
    return await this.prismaService.organizationCampaign.create({ data: form });
  }

  async getAllCampaigns(
    form: Prisma.OrganizationCampaignWhereInput,
  ): Promise<OrganizationCampaign[]> {
    return await this.prismaService.organizationCampaign.findMany({
      where: {
        organizationId: form.organizationId,
        isSoftDeleted: form.isSoftDeleted,
      },
    });
  }

  async updateCampaign(
    newCampaign: Prisma.OrganizationCampaignUpdateInput,
    where: Prisma.OrganizationCampaignWhereUniqueInput,
  ): Promise<OrganizationCampaign> {
    return await this.prismaService.organizationCampaign.update({
      where,
      data: newCampaign,
    });
  }

  async getCampaign(
    where: Prisma.OrganizationCampaignWhereUniqueInput,
  ): Promise<OrganizationCampaign> {
    const campaign = await this.prismaService.organizationCampaign.findFirst({
      where: where as Prisma.OrganizationCampaignWhereInput,
    });

    if (!campaign) {
      throw new CommonException('Campaign not found', StatusCodes.NOT_FOUND);
    }

    return campaign;
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
}
