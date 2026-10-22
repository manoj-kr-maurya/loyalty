import { Injectable } from '@nestjs/common';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

export interface TierLike {
  id: string;
  name: string;
  level: number;
  minPoints: number;
  maxPoints?: number | null;
  multiplier: number | string | { toString(): string };
}

export interface EarningCalculation {
  pointsEarned: number;
  tierMultiplier: number;
  effectiveRate: number;
  currentTier: TierLike;
  projectedTier: TierLike;
  tierUpgraded: boolean;
  newCurrentPoints: number;
  newLifetimePoints: number;
}

@Injectable()
export class EarningCalculatorService {
  calculate(params: {
    amount: number;
    tiers: TierLike[];
    currentTier?: TierLike | null;
    currentPoints?: number;
    lifetimePoints?: number;
  }): EarningCalculation {
    const {
      amount,
      tiers,
      currentTier,
      currentPoints = 0,
      lifetimePoints = 0,
    } = params;

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new CommonException(
        'Amount must be greater than zero',
        StatusCodes.BAD_REQUEST,
      );
    }

    if (tiers.length === 0) {
      throw new CommonException(
        'No loyalty tiers configured for this organization',
        StatusCodes.NOT_FOUND,
      );
    }

    const sorted = [...tiers].sort((a, b) => a.level - b.level);
    const baseTier = currentTier ?? sorted[0];
    const tierMultiplier = Number(baseTier.multiplier);

    if (!Number.isFinite(tierMultiplier) || tierMultiplier < 0) {
      throw new CommonException(
        `Invalid tier multiplier for tier "${baseTier.name}"`,
        StatusCodes.BAD_REQUEST,
      );
    }

    const pointsEarned = Math.max(0, Math.floor(amount * tierMultiplier));
    const newCurrentPoints = currentPoints + pointsEarned;
    const newLifetimePoints = lifetimePoints + pointsEarned;

    let projectedTier = sorted[0];
    for (const tier of sorted) {
      if (newLifetimePoints >= tier.minPoints) {
        projectedTier = tier;
      }
    }

    if (projectedTier.level < baseTier.level) {
      projectedTier = baseTier;
    }

    return {
      pointsEarned,
      tierMultiplier,
      effectiveRate: tierMultiplier,
      currentTier: baseTier,
      projectedTier,
      tierUpgraded: projectedTier.level > baseTier.level,
      newCurrentPoints,
      newLifetimePoints,
    };
  }
}
