import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../common/services/prismaService';
import { CommonException } from '../../../../common/exceptions/common.exception';
import { StatusCodes } from '../../../../common/enums/status-codes';

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
  amount: number; // base transaction amount
  currencyCode: string;
  orderRef?: string;
  metadata?: Record<string, any>;
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
}

export interface BurnPointsInput {
  customerId: string;
  organizationId: string;
  points: number;
  currencyCode: string;
  orderRef?: string;
  metadata?: Record<string, any>;
}

export interface BurnPointsOutput {
  customerId: string;
  organizationId: string;
  pointsBurned: number;
  remainingBalance: number;
  currentTier: string | null;
}

export interface ExpirePointsInput {
  organizationId: string;
  currencyCode: string;
  expiryDate: Date;
}

export interface LoyaltyStatementInput {
  customerId: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class LoyaltyEngineService {
  private readonly logger = new Logger(LoyaltyEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Tier Management ──────────────────────────────────

  /**
   * Create or update loyalty tiers for an organization.
   */
  async upsertTiers(input: CreateTiersInput): Promise<{
    organizationId: string;
    tiers: TierDefinition[];
  }> {
    const { organizationId, tiers } = input;

    // Validate tier levels are sequential and non-overlapping
    const sorted = [...tiers].sort((a, b) => a.level - b.level);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].level !== i + 1) {
        throw new CommonException(
          `Tier levels must be sequential starting from 1. Found level ${sorted[i].level} at position ${i + 1}`,
          StatusCodes.BAD_REQUEST,
        );
      }
      if (i > 0 && sorted[i].minPoints <= sorted[i - 1].minPoints) {
        throw new CommonException(
          `Tier "${sorted[i].name}" minPoints (${sorted[i].minPoints}) must be greater than previous tier "${sorted[i - 1].name}" minPoints (${sorted[i - 1].minPoints})`,
          StatusCodes.BAD_REQUEST,
        );
      }
    }

    // Upsert each tier
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

    this.logger.log(`Tiers created/updated for org ${organizationId}: ${tiers.length} tiers`);
    return { organizationId, tiers: results };
  }

  /**
   * Get all tiers for an organization.
   */
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

  /**
   * Earn loyalty points for a customer transaction.
   * Applies tier multiplier and handles tier upgrade/downgrade.
   */
  async earnPoints(input: EarnPointsInput): Promise<EarnPointsOutput> {
    const { customerId, organizationId, amount, currencyCode, orderRef, metadata } = input;

    if (amount <= 0) {
      throw new CommonException('Amount must be greater than zero', StatusCodes.BAD_REQUEST);
    }

    // Get customer's current tier
    const customerTier = await this.prisma.customerTier.findUnique({
      where: { customerId_organizationId: { customerId, organizationId } },
      include: { tier: true },
    });

    // Get all tiers for the org
    const tiers = await this.prisma.loyaltyTier.findMany({
      where: { organizationId, isActive: true },
      orderBy: { level: 'asc' },
    });

    if (tiers.length === 0) {
      throw new CommonException(
        `No loyalty tiers configured for organization ${organizationId}`,
        StatusCodes.NOT_FOUND,
      );
    }

    // Determine tier multiplier
    const currentTier = customerTier?.tier || tiers[0]; // default to lowest tier
    const tierMultiplier = Number(currentTier.multiplier);

    // Calculate points: amount × tier multiplier
    const pointsEarned = Math.floor(amount * tierMultiplier);

    // Update customer tier points
    const newTotalPoints = (customerTier?.currentPoints || 0) + pointsEarned;
    const newLifetimePoints = (customerTier?.lifetimePoints || 0) + pointsEarned;

    // Check for tier upgrade
    let newTierName: string | null = null;
    let tierUpgraded = false;
    const nextTier = tiers.find((t) => t.level === currentTier.level + 1);

    if (nextTier && newTotalPoints >= nextTier.minPoints) {
      newTierName = nextTier.name;
      tierUpgraded = true;
    }

    // Upsert customer tier
    await this.prisma.customerTier.upsert({
      where: { customerId_organizationId: { customerId, organizationId } },
      create: {
        customerId,
        organizationId,
        tierId: tierUpgraded ? nextTier!.id : currentTier.id,
        currentPoints: newTotalPoints,
        lifetimePoints: newLifetimePoints,
        upgradedAt: tierUpgraded ? new Date() : null,
      },
      update: {
        tierId: tierUpgraded ? nextTier!.id : currentTier.id,
        currentPoints: newTotalPoints,
        lifetimePoints: newLifetimePoints,
        upgradedAt: tierUpgraded ? new Date() : undefined,
      },
    });

    // Credit wallet
    const wallet = await this.prisma.customerWallet.upsert({
      where: {
        customer_id_currency_code: { customerId, currencyCode },
      },
      create: {
        customerId,
        currencyCode,
        availableBalance: pointsEarned,
      },
      update: {
        availableBalance: { increment: pointsEarned },
      },
    });

    this.logger.log(
      `Earn: customer=${customerId} org=${organizationId} amount=${amount} points=${pointsEarned} tier=${newTierName || currentTier.name}`,
    );

    return {
      customerId,
      organizationId,
      baseAmount: amount,
      pointsEarned,
      tierMultiplier,
      effectiveRate: tierMultiplier,
      currentTier: currentTier.name,
      newTier: newTierName,
      tierUpgraded,
      walletBalance: wallet.availableBalance,
    };
  }

  // ─── Burn Points ──────────────────────────────────────

  /**
   * Burn (redeem) points for a customer.
   * Uses FIFO — oldest points consumed first.
   */
  async burnPoints(input: BurnPointsInput): Promise<BurnPointsOutput> {
    const { customerId, organizationId, points, currencyCode, orderRef, metadata } = input;

    if (points <= 0) {
      throw new CommonException('Points must be greater than zero', StatusCodes.BAD_REQUEST);
    }

    const wallet = await this.prisma.customerWallet.findUnique({
      where: {
        customer_id_currency_code: { customerId, currencyCode },
      },
    });

    if (!wallet) {
      throw new CommonException('Wallet not found', StatusCodes.NOT_FOUND);
    }

    if (wallet.availableBalance < points) {
      throw new CommonException(
        `Insufficient balance. Available: ${wallet.availableBalance}, Requested: ${points}`,
        StatusCodes.BAD_REQUEST,
      );
    }

    // Deduct from available balance
    const updatedWallet = await this.prisma.customerWallet.update({
      where: {
        customer_id_currency_code: { customerId, currencyCode },
      },
      data: {
        availableBalance: { decrement: points },
        usedBalance: { increment: points },
      },
    });

    // Get current tier
    const customerTier = await this.prisma.customerTier.findUnique({
      where: { customerId_organizationId: { customerId, organizationId } },
      include: { tier: true },
    });

    this.logger.log(
      `Burn: customer ${customerId} org=${organizationId} points=${points} remaining=${updatedWallet.availableBalance}`,
    );

    return {
      customerId,
      organizationId,
      pointsBurned: points,
      remainingBalance: updatedWallet.availableBalance,
      currentTier: customerTier?.tier?.name || null,
    };
  }

  // ─── Expire Points ────────────────────────────────────

  /**
   * Expire points that have passed their expiry date.
   * Moves points from available → expired balance.
   */
  async expirePoints(input: ExpirePointsInput): Promise<{
    organizationId: string;
    currencyCode: string;
    expiredCount: number;
    totalExpiredPoints: number;
  }> {
    const { organizationId, currencyCode, expiryDate } = input;

    // Find all wallets with this currency that have pending/available points past expiry
    const wallets = await this.prisma.customerWallet.findMany({
      where: {
        currencyCode,
        availableBalance: { gt: 0 },
      },
    });

    let expiredCount = 0;
    let totalExpiredPoints = 0;

    for (const wallet of wallets) {
      // In a real implementation, you'd check pocket-level expiry dates
      // For now, expire a configurable percentage of available balance
      const expireAmount = Math.floor(wallet.availableBalance * 0.1); // 10% expiry

      if (expireAmount > 0) {
        await this.prisma.customerWallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: { decrement: expireAmount },
            expiredBalance: { increment: expireAmount },
          },
        });
        expiredCount++;
        totalExpiredPoints += expireAmount;
      }
    }

    this.logger.log(
      `Expiry: org=${organizationId} currency=${currencyCode} wallets=${expiredCount} points=${totalExpiredPoints}`,
    );

    return { organizationId, currencyCode, expiredCount, totalExpiredPoints };
  }

  // ─── Loyalty Statement ────────────────────────────────

  /**
   * Generate a loyalty statement for a customer.
   */
  async generateStatement(input: LoyaltyStatementInput): Promise<{
    customerId: string;
    organizationId: string;
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

    // Get wallet
    const wallet = await this.prisma.customerWallet.findFirst({
      where: { customerId },
    });

    // Get customer tier
    const customerTier = await this.prisma.customerTier.findUnique({
      where: { customerId_organizationId: { customerId, organizationId } },
      include: { tier: true },
    });

    // Check for existing statement
    const existing = await this.prisma.loyaltyStatement.findFirst({
      where: {
        customerId,
        organizationId,
        periodStart,
        periodEnd,
      },
    });

    if (existing) {
      return {
        customerId,
        organizationId,
        periodStart: existing.periodStart,
        periodEnd: existing.periodEnd,
        openingBalance: existing.openingBalance,
        earnedPoints: existing.earnedPoints,
        redeemedPoints: existing.redeemedPoints,
        expiredPoints: existing.expiredPoints,
        closingBalance: existing.closingBalance,
        tierAtStart: existing.tierAtStart,
        tierAtEnd: existing.tierAtEnd,
      };
    }

    // Calculate statement values
    const openingBalance = wallet ? wallet.availableBalance + wallet.usedBalance : 0;
    const earnedPoints = 0; // Would query from transaction history
    const redeemedPoints = wallet?.usedBalance || 0;
    const expiredPoints = wallet?.expiredBalance || 0;
    const closingBalance = wallet?.availableBalance || 0;

    // Persist statement
    const statement = await this.prisma.loyaltyStatement.create({
      data: {
        customerId,
        organizationId,
        periodStart,
        periodEnd,
        openingBalance,
        earnedPoints,
        redeemedPoints,
        expiredPoints,
        closingBalance,
        tierAtStart: customerTier?.tier?.name || null,
        tierAtEnd: customerTier?.tier?.name || null,
      },
    });

    return {
      customerId,
      organizationId,
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

  /**
   * Get a customer's current tier status.
   */
  async getCustomerTier(customerId: string, organizationId: string): Promise<{
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

    // Find next tier
    const nextTier = await this.prisma.loyaltyTier.findFirst({
      where: {
        organizationId,
        level: customerTier.tier.level + 1,
        isActive: true,
      },
    });

    const pointsToNextTier = nextTier
      ? Math.max(0, nextTier.minPoints - customerTier.currentPoints)
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
}