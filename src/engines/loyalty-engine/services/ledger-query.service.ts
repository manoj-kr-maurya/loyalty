import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';
import { CallStatuses, StatusCodes } from 'src/common/enums/status-codes';
import { getPaginationMetadata } from 'src/common/utils/pagination.util';
import { LedgerQueryDto } from '../dto/ledger-query.dto';

@Injectable()
export class LedgerQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(customerId: string, query: LedgerQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const from = this.parseDate(query.from, 'from');
    const to = this.parseDate(query.to, 'to');

    if (from && to && from > to) {
      throw new CommonException(
        '`from` must be before or equal to `to`',
        StatusCodes.BAD_REQUEST,
      );
    }

    const where: Prisma.LoyaltyLedgerEntryWhereInput = {
      customerId,
      ...(query.organizationId && {
        organizationId: query.organizationId,
      }),
      ...(query.currencyCode && { currencyCode: query.currencyCode }),
      ...(query.type?.length && { type: { in: query.type } }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      }),
      ...(query.reference && {
        OR: [
          {
            referenceId: {
              contains: query.reference,
              mode: 'insensitive',
            },
          },
          {
            referenceType: {
              contains: query.reference,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const [entries, totalItems] = await Promise.all([
      this.prisma.loyaltyLedgerEntry.findMany({
        where,
        orderBy: [{ createdAt: query.sort ?? 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.loyaltyLedgerEntry.count({ where }),
    ]);

    const metadata =
      totalItems === 0
        ? {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limit,
            hasNextPage: false,
            hasPreviousPage: false,
            startItem: 0,
            endItem: 0,
          }
        : getPaginationMetadata(totalItems, page, limit);

    return {
      status: CallStatuses.Success,
      data: entries,
      metadata,
    };
  }

  private parseDate(
    value: string | undefined,
    field: string,
  ): Date | undefined {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new CommonException(
        `Invalid \`${field}\` date`,
        StatusCodes.BAD_REQUEST,
      );
    }
    return parsed;
  }
}
