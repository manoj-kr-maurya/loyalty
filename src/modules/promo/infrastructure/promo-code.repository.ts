import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/services/prismaService';

@Injectable()
export class PromoCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  runSerializable<T>(
    work: (repository: PromoCodeRepository) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      (tx) => work(new PromoCodeRepository(tx as unknown as PrismaService)),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  findUnique(code: string) {
    return this.prisma.promoCode.findUnique({ where: { code } });
  }

  create(data: Prisma.PromoCodeUncheckedCreateInput) {
    return this.prisma.promoCode.create({ data });
  }

  incrementUsedCount(id: string) {
    return this.prisma.promoCode.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    });
  }

  countRedemptions(promoCodeId: string, customerId: string) {
    return this.prisma.promoRedemption.count({
      where: { promoCodeId, customerId },
    });
  }

  createRedemption(data: Prisma.PromoRedemptionUncheckedCreateInput) {
    return this.prisma.promoRedemption.create({ data });
  }

  findCodesForStacking(
    codes: string[],
    organizationId: string,
    customerId: string,
  ) {
    return this.prisma.promoCode.findMany({
      where: {
        code: { in: codes },
        organizationId,
      },
      include: {
        redemptions: {
          where: { customerId },
          select: { id: true },
        },
      },
    });
  }

  findRedemptions(customerId: string, organizationId: string) {
    return this.prisma.promoRedemption.findMany({
      where: { customerId, organizationId },
      include: { promoCode: { select: { code: true } } },
      orderBy: { redeemedAt: 'desc' },
    });
  }
}
