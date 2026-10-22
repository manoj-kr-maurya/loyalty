import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prismaService';
import { OrganizationRoles, Prisma } from '@prisma/client';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { getPaginationMetadata } from 'src/common/utils/pagination.util';
import { CustomerOrderFiltersDto } from '../organization/DTO/organization-response.dto';
import { InviteAdminForm } from './DTO/admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async fetchAllOrganizations(query: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where: Prisma.OrganizationWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Get total count for pagination
    const totalItems = await this.prisma.organization.count({ where });

    // Get paginated organizations
    const organizations = await this.prisma.organization.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        countryCode: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        address: true,
      },
    });

    // Calculate pagination metadata
    const metadata = getPaginationMetadata(totalItems, page, limit);

    return { organizations, metadata };
  }

  async fetchAllCustomers(query: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where: Prisma.CustomerWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Get total count for pagination
    const totalItems = await this.prisma.customer.count({ where });

    // Get paginated organizations
    const customers = await this.prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        countryCode: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Calculate pagination metadata
    const metadata = getPaginationMetadata(totalItems, page, limit);

    return { customers, metadata };
  }

  async fetchOrganizationById(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        currencies: true,
        metaFlags: true,
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return organization;
  }

  async fetchCustomerById(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        metaFlags: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return customer;
  }

  async fetchOrganizationCampaigns(
    organizationId: string,
    query: PaginationQueryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [campaigns, totalItems] = await Promise.all([
      this.prisma.organizationCampaign.findMany({
        where: {
          organizationId,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.organizationCampaign.count({
        where: {
          organizationId,
        },
      }),
    ]);

    const metadata = getPaginationMetadata(totalItems, page, limit);

    return { campaigns, metadata };
  }

  async fetchCustomerWallets(customerId: string, query: PaginationQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [wallets, totalItems] = await Promise.all([
      this.prisma.customerWallet.findMany({
        where: {
          customerId,
        },
        include: {
          pockets: {
            include: {
              transactions: {
                orderBy: {
                  createdAt: 'desc',
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.customerWallet.count({
        where: {
          customerId,
        },
      }),
    ]);

    const metadata = getPaginationMetadata(totalItems, page, limit);

    return {
      wallets,
      metadata,
    };
  }

  async fetchOrganizationCurrencies(
    organizationId: string,
    query: PaginationQueryDto,
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    // Get currencies with their exchange rates and buckets
    const currencies = await this.prisma.currency.findMany({
      where: {
        organizationId,
      },
      include: {
        exchangeRates: {
          where: {
            physicalCurrencyCode: 'INR',
          },
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      skip,
      take: limit,
    });

    // Get corresponding currency buckets
    const buckets = await this.prisma.currencyBucket.findMany({
      where: {
        organizationId,
        code: {
          in: currencies.map((c) => c.code),
        },
      },
    });

    // Merge currency and bucket data
    const unifiedCurrencies = currencies.map((currency) => {
      const bucket = buckets.find((b) => b.code === currency.code);
      return {
        id: currency.id,
        name: currency.name,
        code: currency.code,
        symbol: currency.symbol,
        exchangeRate: currency.exchangeRates[0]?.rate.toNumber() || 1,
        availableAmount: bucket?.availableAmount || 0,
        distributedAmount: bucket?.distributedAmount || 0,
        receivedAmount: bucket?.receivedAmount || 0,
      };
    });

    const totalItems = await this.prisma.currency.count({
      where: {
        organizationId,
      },
    });

    const metadata = getPaginationMetadata(totalItems, page, limit);

    return { currencies: unifiedCurrencies, metadata };
  }
  async fetchOrganizationCustomerOrders(
    organizationId: string,
    query: PaginationQueryDto & CustomerOrderFiltersDto,
  ) {
    const { page = 1, limit = 10, status, search, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.CustomerOrganizationOrderWhereInput = {
      organizationId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { customerId: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(dateFrom && {
        createdAt: {
          gte: new Date(dateFrom),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [orders, totalItems] = await Promise.all([
      this.prisma.customerOrganizationOrder.findMany({
        where: whereClause,
        include: {
          customerEarningAmountDetail: {
            include: {
              coin: true,
            },
          },
          customerBurningAmountDetail: {
            include: {
              cash: true,
              coin: true,
            },
          },
        },
        skip,
        take: +limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.customerOrganizationOrder.count({
        where: whereClause,
      }),
    ]);

    const metadata = getPaginationMetadata(totalItems, page, limit);

    return { orders, metadata };
  }

  async fetchCustomerOrders(
    customerId: string,
    query: PaginationQueryDto & CustomerOrderFiltersDto,
  ) {
    const { page = 1, limit = 10, status, search, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.CustomerOrganizationOrderWhereInput = {
      customerId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { customerId: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(dateFrom && {
        createdAt: {
          gte: new Date(dateFrom),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [orders, totalItems] = await Promise.all([
      this.prisma.customerOrganizationOrder.findMany({
        where: whereClause,
        include: {
          customerEarningAmountDetail: {
            include: {
              coin: true,
            },
          },
          customerBurningAmountDetail: {
            include: {
              cash: true,
              coin: true,
            },
          },
        },
        skip,
        take: +limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.customerOrganizationOrder.count({
        where: whereClause,
      }),
    ]);

    const metadata = getPaginationMetadata(totalItems, page, limit);

    return { orders, metadata };
  }

  async inviteAdmin(form: InviteAdminForm) {
    return await this.prisma.invite.create({
      data: {
        assignedTo: form.phoneNumber,
        location: form.location,
        role: OrganizationRoles.ADMIN,
        orgAdminId: 'ADMIN',
        generatedBy: 'ADMIN',
      },
    });
  }
}
