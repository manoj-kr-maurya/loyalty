import { Injectable, Logger } from '@nestjs/common';
import { LoyaltyLedgerType } from '@prisma/client';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';
import { EarningCalculatorService } from './services/earning-calculator.service';
import { IdempotencyService } from './services/idempotency.service';
import { OutboxService } from './services/outbox.service';
import { WalletLedgerService } from './services/wallet-ledger.service';

// ─── Input / Output Types ───────────────────────────────

export interface TierDefinition {
  name: string;
  level: number;
  minPoints: number;
  maxPoints?: number;
  multiplier: number;
  benefits?: Record<string, any>;
  color?: string;
  iconUrl?: string;
}

export interface CreateTiersInput {
  organizationId: string;
  tiers: TierDefinition[];
}

export interface EarnPointsInput {
  customerId: string;
  organizationId: string;
  amount: number;
  currencyCode: string;
  orderRef?: string;
  expiryDate?: string | Date;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface EarnPointsOutput {
  customerId: string;
  organizationId: string;
  baseAmount: number;
  pointsEarned: number;
  tierMultiplier: number;
  effectiveRate: number;
  currentTier: string | null;
  newTier: string | null;
  tierUpgraded: boolean;
  walletBalance: number;
  ledgerEntryId?: string;
  expiryDate?: string | null;
}

export interface BurnPointsInput {
  customerId: string;
  organizationId: string;
  points: number;
  currencyCode: string;
  orderRef?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface BurnPointsOutput {
  customerId: string;
  organizationId: string;
  pointsBurned: number;
  remainingBalance: number;
  currentTier: string | null;
  ledgerEntryId?: string;
}

export interface EstimatePointsInput {
  customerId: string;
  organizationId: string;
  amount: number;
  currencyCode?: string;
}

export interface EstimatePointsOutput {
  customerId: string;
  organizationId: string;
  baseAmount: number;
  pointsEarned: number;
  tierMultiplier: number;
  effectiveRate: number;
  currentTier: string | null;
  projectedTier: string;
  tierUpgraded: boolean;
  currentPoints: number;
  lifetimePoints: number;
}

export interface ExpirePointsInput {
  organizationId: string;
  currencyCode: string;
  expiryDate: Date;
}

export interface LoyaltyStatementInput {
  customerId: string;
  organizationId: string;
  currencyCode?: string;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class LoyaltyEngineService {
  private readonly logger = new Logger(LoyaltyEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: EarningCalculatorService,
    private readonly idempotency: IdempotencyService,
    private readonly walletLedger: WalletLedgerService,
    private readonly outbox: OutboxService,
  ) {}

  // ─── Tier Management ──────────────────────────────────

  async upsertTiers(input: CreateTiersInput): Promise<{
    organizationId: string;
    tiers: TierDefinition[];
  }> {
    const { organizationId, tiers } = input;

    const sorted = [...tiers].sort((a, b) => a.level - b.level);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].level !== i + 1) {
        throw new CommonException(
          `Tier levels must be sequential starting from 1. Found level ${
            sorted[i].level
          } at position ${i + 1}`,
          StatusCodes.BAD_REQUEST,
        );
      }
      if (i > 0 && sorted[i].minPoints <= sorted[i - 1].minPoints) {
        throw new CommonException(
          `Tier "${sorted[i].name}" minPoints (${
            sorted[i].minPoints
          }) must be greater than previous tier "${
            sorted[i - 1].name
          }" minPoints (${sorted[i - 1].minPoints})`,
          StatusCodes.BAD_REQUEST,
        );
      }
    }

    const results: TierDefinition[] = [];
    for (const tier of tiers) {
      const upserted = await this.prisma.loyaltyTier.upsert({
        where: {
          organizationId_name: { organizationId, name: tier.name },
        },
        create: {
          organizationId,
          name: tier.name,
          level: tier.level,
          minPoints: tier.minPoints,
          maxPoints: tier.maxPoints,
          multiplier: tier.multiplier,
          benefits: tier.benefits || {},
          color: tier.color,
          iconUrl: tier.iconUrl,
        },
        update: {
          level: tier.level,
          minPoints: tier.minPoints,
          maxPoints: tier.maxPoints,
          multiplier: tier.multiplier,
          benefits: tier.benefits || {},
          color: tier.color,
          iconUrl: tier.iconUrl,
        },
      });
      results.push({
        name: upserted.name,
        level: upserted.level,
        minPoints: upserted.minPoints,
        maxPoints: upserted.maxPoints ?? undefined,
        multiplier: Number(upserted.multiplier),
        benefits: upserted.benefits as Record<string, any> | undefined,
        color: upserted.color ?? undefined,
        iconUrl: upserted.iconUrl ?? undefined,
      });
    }

    this.logger.log(
      `Tiers created/updated for org ${organizationId}: ${tiers.length} tiers`,
    );
    return { organizationId, tiers: results };
  }

  async getTiers(organizationId: string): Promise<TierDefinition[]> {
    const tiers = await this.prisma.loyaltyTier.findMany({
      where: { organizationId, isActive: true },
      orderBy: { level: 'asc' },
    });

    return tiers.map((t) => ({
      name: t.name,
      level: t.level,
      minPoints: t.minPoints,
      maxPoints: t.maxPoints ?? undefined,
      multiplier: Number(t.multiplier),
      benefits: t.benefits as Record<string, any> | undefined,
      color: t.color ?? undefined,
      iconUrl: t.iconUrl ?? undefined,
    }));
  }

  // ─── Earn Points ──────────────────────────────────────

  async earnPoints(input: EarnPointsInput): Promise<EarnPointsOutput> {
    const {
      customerId,
      organizationId,
      amount,
      currencyCode,
      orderRef,
      metadata,
      idempotencyKey,
    } = input;

    if (amount <= 0) {
      throw new CommonException(
        'Amount must be greater than zero',
        StatusCodes.BAD_REQUEST,
      );
    }

    const expiryDate = this.parseOptionalDate(input.expiryDate);

    return this.idempotency.execute<EarnPointsOutput>({
      key: idempotencyKey,
      operation: 'earn',
      organizationId,
      customerId,
      request: {
        customerId,
        organizationId,
        amount,
        currencyCode,
        orderRef,
        expiryDate: expiryDate?.toISOString(),
        metadata,
      },
      work: async (tx) => {
        const tiers = await tx.loyaltyTier.findMany({
          where: { organizationId, isActive: true },
          orderBy: { level: 'asc' },
        });

        if (tiers.length === 0) {
          throw new CommonException(
            `No loyalty tiers configured for organization ${organizationId}`,
            StatusCodes.NOT_FOUND,
          );
        }

        const customerTier = await tx.customerTier.findUnique({
          where: { customerId_organizationId: { customerId, organizationId } },
          include: { tier: true },
        });

        const calculation = this.calculator.calculate({
          amount,
          tiers,
          currentTier: customerTier?.tier ?? null,
          currentPoints: customerTier?.currentPoints ?? 0,
          lifetimePoints: customerTier?.lifetimePoints ?? 0,
        });

        await tx.customerTier.upsert({
          where: {
            customerId_organizationId: { customerId, organizationId },
          },
          create: {
            customerId,
            organizationId,
            tierId: calculation.projectedTier.id,
            currentPoints: calculation.newCurrentPoints,
            lifetimePoints: calculation.newLifetimePoints,
            upgradedAt: calculation.tierUpgraded ? new Date() : null,
          },
          update: {
            tierId: calculation.projectedTier.id,
            currentPoints: calculation.newCurrentPoints,
            lifetimePoints: calculation.newLifetimePoints,
            ...(calculation.tierUpgraded && { upgradedAt: new Date() }),
          },
        });

        let walletBalance = 0;
        let ledgerEntryId: string | undefined;

        if (calculation.pointsEarned > 0) {
          const credit = await this.walletLedger.credit(tx, {
            customerId,
            organizationId,
            currencyCode,
            points: calculation.pointsEarned,
            type: LoyaltyLedgerType.EARN,
            expiryDate: expiryDate ?? null,
            referenceType: 'EARN',
            referenceId: orderRef,
            transactionRef: orderRef,
            idempotencyKey,
            metadata,
          });
          walletBalance = credit.walletBalance;
          ledgerEntryId = credit.ledgerEntryId;
        } else {
          const wallet = await tx.customerWallet.findUnique({
            where: {
              customer_id_organization_currency_code: {
                customerId,
                organizationId,
                currencyCode,
              },
            },
          });
          walletBalance = wallet?.availableBalance ?? 0;
        }

        if (calculation.pointsEarned > 0) {
          await this.outbox.enqueue(tx, {
            organizationId,
            eventType: 'points.earned',
            aggregateId: customerId,
            payload: {
              customerId,
              organizationId,
              currencyCode,
              amount,
              pointsEarned: calculation.pointsEarned,
              tierMultiplier: calculation.tierMultiplier,
              effectiveRate: calculation.effectiveRate,
              currentTier: calculation.currentTier.name,
              orderRef: orderRef ?? null,
              walletBalance,
              expiryDate: expiryDate?.toISOString() ?? null,
              metadata: metadata ?? null,
            },
          });
        }

        if (calculation.tierUpgraded) {
          await this.outbox.enqueue(tx, {
            organizationId,
            eventType: 'tier.upgraded',
            aggregateId: customerId,
            payload: {
              customerId,
              organizationId,
              previousTier: calculation.currentTier.name,
              newTier: calculation.projectedTier.name,
              lifetimePoints: calculation.newLifetimePoints,
            },
          });
        }

        this.logger.log(
          `Earn: customer=${customerId} org=${organizationId} amount=${amount} points=${calculation.pointsEarned} tier=${calculation.projectedTier.name}`,
        );

        return {
          customerId,
          organizationId,
          baseAmount: amount,
          pointsEarned: calculation.pointsEarned,
          tierMultiplier: calculation.tierMultiplier,
          effectiveRate: calculation.effectiveRate,
          currentTier: calculation.currentTier.name,
          newTier: calculation.tierUpgraded
            ? calculation.projectedTier.name
            : null,
          tierUpgraded: calculation.tierUpgraded,
          walletBalance,
          ledgerEntryId,
          expiryDate: expiryDate?.toISOString() ?? null,
        };
      },
    });
  }

  // ─── Burn Points ──────────────────────────────────────

  async burnPoints(input: BurnPointsInput): Promise<BurnPointsOutput> {
    const {
      customerId,
      organizationId,
      points,
      currencyCode,
      orderRef,
      metadata,
      idempotencyKey,
    } = input;

    if (points <= 0) {
      throw new CommonException(
        'Points must be greater than zero',
        StatusCodes.BAD_REQUEST,
      );
    }

    return this.idempotency.execute<BurnPointsOutput>({
      key: idempotencyKey,
      operation: 'burn',
      organizationId,
      customerId,
      request: {
        customerId,
        organizationId,
        points,
        currencyCode,
        orderRef,
        metadata,
      },
      work: async (tx) => {
        const debit = await this.walletLedger.debitFifo(tx, {
          customerId,
          organizationId,
          currencyCode,
          points,
          type: LoyaltyLedgerType.BURN,
          referenceType: 'BURN',
          referenceId: orderRef,
          transactionRef: orderRef,
          idempotencyKey,
          metadata,
        });

        const customerTier = await tx.customerTier.findUnique({
          where: {
            customerId_organizationId: { customerId, organizationId },
          },
          include: { tier: true },
        });

        await this.outbox.enqueue(tx, {
          organizationId,
          eventType: 'points.burned',
          aggregateId: customerId,
          payload: {
            customerId,
            organizationId,
            currencyCode,
            pointsBurned: points,
            remainingBalance: debit.walletBalance,
            orderRef: orderRef ?? null,
            metadata: metadata ?? null,
          },
        });

        this.logger.log(
          `Burn: customer=${customerId} org=${organizationId} points=${points} remaining=${debit.walletBalance}`,
        );

        return {
          customerId,
          organizationId,
          pointsBurned: points,
          remainingBalance: debit.walletBalance,
          currentTier: customerTier?.tier?.name ?? null,
          ledgerEntryId: debit.ledgerEntryId,
        };
      },
    });
  }

  // ─── Estimate Points ──────────────────────────────────

  async estimatePoints(
    input: EstimatePointsInput,
  ): Promise<EstimatePointsOutput> {
    const { customerId, organizationId, amount } = input;

    const tiers = await this.prisma.loyaltyTier.findMany({
      where: { organizationId, isActive: true },
      orderBy: { level: 'asc' },
    });

    const customerTier = await this.prisma.customerTier.findUnique({
      where: { customerId_organizationId: { customerId, organizationId } },
      include: { tier: true },
    });

    const calculation = this.calculator.calculate({
      amount,
      tiers,
      currentTier: customerTier?.tier ?? null,
      currentPoints: customerTier?.currentPoints ?? 0,
      lifetimePoints: customerTier?.lifetimePoints ?? 0,
    });

    return {
      customerId,
      organizationId,
      baseAmount: amount,
      pointsEarned: calculation.pointsEarned,
      tierMultiplier: calculation.tierMultiplier,
      effectiveRate: calculation.effectiveRate,
      currentTier: calculation.currentTier.name,
      projectedTier: calculation.projectedTier.name,
      tierUpgraded: calculation.tierUpgraded,
      currentPoints: calculation.newCurrentPoints,
      lifetimePoints: calculation.newLifetimePoints,
    };
  }

  // ─── Expire Points ────────────────────────────────────

  async expirePoints(input: ExpirePointsInput): Promise<{
    organizationId: string;
    currencyCode: string;
    expiredCount: number;
    totalExpiredPoints: number;
  }> {
    const { organizationId, currencyCode } = input;

    const expiryDate =
      input.expiryDate instanceof Date
        ? input.expiryDate
        : new Date(input.expiryDate);
    if (Number.isNaN(expiryDate.getTime())) {
      throw new CommonException(
        'expiryDate must be a valid date',
        StatusCodes.BAD_REQUEST,
      );
    }

    const currency = await this.prisma.currency.findUnique({
      where: {
        organization_id_currency_code_currency: {
          organizationId,
          code: currencyCode,
        },
      },
      select: { organizationId: true },
    });

    if (!currency || currency.organizationId !== organizationId) {
      throw new CommonException(
        `Currency ${currencyCode} does not belong to organization ${organizationId}`,
        StatusCodes.BAD_REQUEST,
      );
    }

    const wallets = await this.prisma.customerWallet.findMany({
      where: {
        organizationId,
        currencyCode,
        availableBalance: { gt: 0 },
      },
      select: { customerId: true },
    });

    let expiredCount = 0;
    let totalExpiredPoints = 0;

    for (const wallet of wallets) {
      const result = await this.prisma.$transaction((tx) =>
        this.walletLedger.expirePockets(tx, {
          customerId: wallet.customerId,
          organizationId,
          currencyCode,
          asOf: expiryDate,
        }),
      );

      if (result.expiredPoints > 0) {
        expiredCount++;
        totalExpiredPoints += result.expiredPoints;
      }
    }

    this.logger.log(
      `Expiry: org=${organizationId} currency=${currencyCode} asOf=${expiryDate.toISOString()} wallets=${expiredCount} points=${totalExpiredPoints}`,
    );

    return {
      organizationId,
      currencyCode,
      expiredCount,
      totalExpiredPoints,
    };
  }

  // ─── Loyalty Statement ────────────────────────────────

  async generateStatement(input: LoyaltyStatementInput): Promise<{
    customerId: string;
    organizationId: string;
    currencyCode: string;
    periodStart: Date;
    periodEnd: Date;
    openingBalance: number;
    earnedPoints: number;
    redeemedPoints: number;
    expiredPoints: number;
    closingBalance: number;
    tierAtStart: string | null;
    tierAtEnd: string | null;
  }> {
    const { customerId, organizationId, periodStart, periodEnd } = input;

    if (
      Number.isNaN(periodStart.getTime()) ||
      Number.isNaN(periodEnd.getTime())
    ) {
      throw new CommonException(
        'periodStart and periodEnd must be valid dates',
        StatusCodes.BAD_REQUEST,
      );
    }
    if (periodStart > periodEnd) {
      throw new CommonException(
        'periodStart must be before or equal to periodEnd',
        StatusCodes.BAD_REQUEST,
      );
    }

    const currency = input.currencyCode
      ? await this.prisma.currency.findUnique({
          where: {
            organization_id_currency_code_currency: {
              organizationId,
              code: input.currencyCode,
            },
          },
          select: { code: true, organizationId: true },
        })
      : await this.prisma.currency.findFirst({
          where: { organizationId },
          orderBy: { code: 'asc' },
          select: { code: true, organizationId: true },
        });

    if (!currency || currency.organizationId !== organizationId) {
      throw new CommonException(
        'A currency owned by the organization is required for a statement',
        StatusCodes.BAD_REQUEST,
      );
    }

    const currencyCode = currency.code;

    const [
      wallet,
      order,
      customerTier,
      opening,
      period,
      earned,
      burned,
      expired,
    ] = await Promise.all([
      this.prisma.customerWallet.findUnique({
        where: {
          customer_id_organization_currency_code: {
            customerId,
            organizationId,
            currencyCode,
          },
        },
      }),
      this.prisma.customerOrganizationOrder.findFirst({
        where: { customerId, organizationId },
        select: { id: true },
      }),
      this.prisma.customerTier.findUnique({
        where: { customerId_organizationId: { customerId, organizationId } },
        include: { tier: true },
      }),
      this.prisma.loyaltyLedgerEntry.aggregate({
        where: {
          customerId,
          organizationId,
          currencyCode,
          createdAt: { lt: periodStart },
        },
        _sum: { points: true },
      }),
      this.prisma.loyaltyLedgerEntry.aggregate({
        where: {
          customerId,
          organizationId,
          currencyCode,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { points: true },
      }),
      this.prisma.loyaltyLedgerEntry.aggregate({
        where: {
          customerId,
          organizationId,
          currencyCode,
          type: LoyaltyLedgerType.EARN,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { points: true },
      }),
      this.prisma.loyaltyLedgerEntry.aggregate({
        where: {
          customerId,
          organizationId,
          currencyCode,
          type: LoyaltyLedgerType.BURN,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { points: true },
      }),
      this.prisma.loyaltyLedgerEntry.aggregate({
        where: {
          customerId,
          organizationId,
          currencyCode,
          type: LoyaltyLedgerType.EXPIRE,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { points: true },
      }),
    ]);

    if (!wallet && !order) {
      throw new CommonException(
        'Customer has no loyalty activity in this organization',
        StatusCodes.NOT_FOUND,
      );
    }

    const openingBalance = opening._sum.points ?? 0;
    const earnedPoints = Math.max(0, earned._sum.points ?? 0);
    const redeemedPoints = Math.abs(burned._sum.points ?? 0);
    const expiredPoints = Math.abs(expired._sum.points ?? 0);
    const closingBalance = openingBalance + (period._sum.points ?? 0);

    const tierName = customerTier?.tier?.name ?? null;
    const payload = {
      customerId,
      organizationId,
      periodStart,
      periodEnd,
      openingBalance,
      earnedPoints,
      redeemedPoints,
      expiredPoints,
      closingBalance,
      tierAtStart: tierName,
      tierAtEnd: tierName,
    };

    const existing = await this.prisma.loyaltyStatement.findFirst({
      where: { customerId, organizationId, periodStart, periodEnd },
    });

    const statement = existing
      ? await this.prisma.loyaltyStatement.update({
          where: { id: existing.id },
          data: payload,
        })
      : await this.prisma.loyaltyStatement.create({ data: payload });

    return {
      customerId: statement.customerId,
      organizationId: statement.organizationId,
      currencyCode,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      openingBalance: statement.openingBalance,
      earnedPoints: statement.earnedPoints,
      redeemedPoints: statement.redeemedPoints,
      expiredPoints: statement.expiredPoints,
      closingBalance: statement.closingBalance,
      tierAtStart: statement.tierAtStart,
      tierAtEnd: statement.tierAtEnd,
    };
  }

  // ─── Tier Status ──────────────────────────────────────

  async getCustomerTier(
    customerId: string,
    organizationId: string,
  ): Promise<{
    customerId: string;
    organizationId: string;
    currentTier: string | null;
    tierLevel: number | null;
    currentPoints: number;
    lifetimePoints: number;
    nextTier: string | null;
    pointsToNextTier: number | null;
  }> {
    const customerTier = await this.prisma.customerTier.findUnique({
      where: { customerId_organizationId: { customerId, organizationId } },
      include: { tier: true },
    });

    if (!customerTier) {
      return {
        customerId,
        organizationId,
        currentTier: null,
        tierLevel: null,
        currentPoints: 0,
        lifetimePoints: 0,
        nextTier: null,
        pointsToNextTier: null,
      };
    }

    const nextTier = await this.prisma.loyaltyTier.findFirst({
      where: {
        organizationId,
        level: customerTier.tier.level + 1,
        isActive: true,
      },
    });

    const pointsToNextTier = nextTier
      ? Math.max(0, nextTier.minPoints - customerTier.lifetimePoints)
      : null;

    return {
      customerId,
      organizationId,
      currentTier: customerTier.tier.name,
      tierLevel: customerTier.tier.level,
      currentPoints: customerTier.currentPoints,
      lifetimePoints: customerTier.lifetimePoints,
      nextTier: nextTier?.name || null,
      pointsToNextTier,
    };
  }

  private parseOptionalDate(value?: string | Date): Date | undefined {
    if (!value) return undefined;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new CommonException('Invalid expiryDate', StatusCodes.BAD_REQUEST);
    }
    return parsed;
  }
}
