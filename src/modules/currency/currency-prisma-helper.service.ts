import { Injectable } from '@nestjs/common';
import { Currency, CurrencyBucket, Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/services/prismaService';

@Injectable()
export class CurrencyPrismaHelperService {
  constructor(private prismaService: PrismaService) {}

  // Method to execute multiple operations in a transaction
  async executeTransaction<T>(
    operations: ((prisma: Prisma.TransactionClient) => Promise<T>)[],
  ): Promise<T[]> {
    return this.prismaService.$transaction(async (prismaTransaction) => {
      const results: T[] = [];
      for (const operation of operations) {
        results.push(await operation(prismaTransaction));
      }
      return results;
    });
  }

  // Updated methods to accept an optional transaction client

  // Create Currency
  async createCurrency(
    form: Prisma.CurrencyCreateInput,
    prismaTransaction?: Prisma.TransactionClient,
  ): Promise<Currency> {
    const prisma = prismaTransaction || this.prismaService;
    return prisma.currency.create({ data: form });
  }

  // Find Currency by unique input
  async findCurrency(
    where: Prisma.CurrencyWhereUniqueInput,
    prismaTransaction?: Prisma.TransactionClient,
  ): Promise<Currency> {
    const prisma = prismaTransaction || this.prismaService;
    return prisma.currency.findFirstOrThrow({ where });
  }

  async findCurrencyBuckets(
    where: Prisma.CurrencyBucketWhereInput,
    prismaTransaction?: Prisma.TransactionClient,
  ): Promise<CurrencyBucket[]> {
    const prisma = prismaTransaction || this.prismaService;
    return prisma.currencyBucket.findMany({ where });
  }

  // Find multiple currencies based on input
  async findCurrencies(
    where: Prisma.CurrencyWhereInput,
    prismaTransaction?: Prisma.TransactionClient,
  ) {
    const prisma = prismaTransaction || this.prismaService;
    return prisma.currency.findMany({ where });
  }

  // Update Organization's Currency Bucket
  async updateOrganizationCurrencyBucketAndReturnOrganization(
    organizationId: string,
    currencyCode: string,
    amountToAdd: number,
    prismaTransaction?: Prisma.TransactionClient,
  ) {
    const prisma = prismaTransaction || this.prismaService;
    return prisma.organization.update({
      where: {
        id: organizationId,
      },
      data: {
        currencyBuckets: {
          update: {
            where: {
              organization_id_currency_code: {
                organizationId,
                code: currencyCode,
              },
            },
            data: {
              availableAmount: {
                increment: amountToAdd,
              },
            },
          },
        },
      },
      include: {
        currencies: true,
        currencyBuckets: true,
      },
    });
  }

  async updateOrganizationCurrencyBucket(
    bucketId: string,
    autoTopUpEnabled: boolean,
    autoTopUpAmount?: number,
    autoTopUpThreshold?: number,
    prismaTransaction?: Prisma.TransactionClient,
  ) {
    const prisma = prismaTransaction || this.prismaService;
    return prisma.currencyBucket.update({
      where: {
        id: bucketId,
      },
      data: {
        autoTopUpEnabled,
        autoTopUpThreshold: autoTopUpThreshold ?? null,
        autoTopUpAmount: autoTopUpAmount ?? null,
      },
    });
  }
}
