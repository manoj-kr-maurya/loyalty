import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prismaService';

export interface CouponValidationInput {
  organizationId: string;
  customerId?: string;
  cartValue?: number;
  cartCategories?: string[];
  isBankOffer?: boolean;
  channel?: string;
  appliedCouponIds?: string[];
}

export interface CouponValidationResult {
  isApplicable: boolean;
  isApplied: boolean;
  couponApplicableMessage: string;
}

export interface ValidationRule {
  name: string;
  validate: (promo: any, input: CouponValidationInput) => string | null | Promise<string | null>;
}

@Injectable()
export class CouponValidatorService {
  private readonly logger = new Logger(CouponValidatorService.name);
  private readonly rules: ValidationRule[] = [];

  constructor(private readonly prisma: PrismaService) {
    this.registerDefaultRules();
  }

  private registerDefaultRules() {
    this.rules.push(
      {
        name: 'status',
        validate: (promo) => {
          if (promo.status !== 'ACTIVE') return 'Promotion is not active';
          return null;
        },
      },
      {
        name: 'archived',
        validate: (promo) => {
          if (promo.isArchived) return 'Promotion has been archived';
          return null;
        },
      },
      {
        name: 'expiry',
        validate: (promo) => {
          const now = new Date();
          if (promo.endDate && new Date(promo.endDate) < now) return 'Promotion has expired';
          if (promo.startDate && new Date(promo.startDate) > now) return 'Promotion has not started yet';
          return null;
        },
      },
      {
        name: 'minimumCartValue',
        validate: (promo, input) => {
          if (!promo.minimumCartValue) return null;
          if (input.cartValue === undefined) return 'Cart value is required for this promotion';
          const min = Number(promo.minimumCartValue);
          if (input.cartValue < min) return `Minimum cart value of ₹${min} required`;
          return null;
        },
      },
      {
        name: 'bankOffer',
        validate: (promo, input) => {
          const businessTypes = (promo.businessType as string[]) ?? [];
          const isBankType = businessTypes.some((t) => t.toLowerCase().includes('bank'));
          if (isBankType && !input.isBankOffer) return 'This is a bank-specific offer';
          if (!isBankType && input.isBankOffer) return 'This offer is not applicable for bank transactions';
          return null;
        },
      },
      {
        name: 'channel',
        validate: (promo, input) => {
          const channels = (promo.channels as string[]) ?? [];
          const hasRestriction = channels.length > 0 && !channels.includes('ALL');
          if (!hasRestriction) return null;
          if (!input.channel) return null;
          const requested = input.channel.toUpperCase();
          if (!channels.includes(requested)) return `This offer is not available on the ${input.channel} channel`;
          return null;
        },
      },
      {
        name: 'categoryApplicability',
        validate: (promo, input) => {
          if (!promo.rules || promo.rules.length === 0) return null;
          if (!input.cartCategories || input.cartCategories.length === 0) return null;
          const rules = promo.rules as any[];
          const categoryRules = rules.filter((r) => r.conditions?.categories);
          if (categoryRules.length === 0) return null;
          const allowedCategories = categoryRules.flatMap((r) => r.conditions.categories ?? []);
          const hasMatch = input.cartCategories.some((c) => allowedCategories.includes(c));
          if (!hasMatch) return 'Promotion is not applicable for items in your cart';
          return null;
        },
      },
      {
        name: 'maxClaimsPerUser',
        validate: async (promo, input) => {
          if (!promo.maxClaimsPerUser || !input.customerId) return null;
          const claimCount = await this.prisma.rewardBlock.count({
            where: { programId: promo.id, customerId: input.customerId, status: 'CONFIRMED' },
          });
          if (claimCount >= promo.maxClaimsPerUser) return 'You have reached the usage limit for this promotion';
          return null;
        },
      },
      {
        name: 'maxClaimsTotal',
        validate: async (promo) => {
          if (!promo.maxClaimsTotal) return null;
          const claimCount = await this.prisma.rewardBlock.count({
            where: { programId: promo.id, status: 'CONFIRMED' },
          });
          if (claimCount >= promo.maxClaimsTotal) return 'This promotion has reached its total usage limit';
          return null;
        },
      },
    );
  }

  addRule(rule: ValidationRule) {
    this.rules.push(rule);
  }

  async validate(promo: any, input: CouponValidationInput): Promise<CouponValidationResult> {
    const isApplied = input.appliedCouponIds?.includes(promo.id) ?? false;

    for (const rule of this.rules) {
      try {
        const message = await Promise.resolve(rule.validate(promo, input));
        if (message) {
          return { isApplicable: false, isApplied, couponApplicableMessage: message };
        }
      } catch (err) {
        this.logger.error(`Validation rule "${rule.name}" failed for promo ${promo.id}`, err);
        return { isApplicable: false, isApplied, couponApplicableMessage: 'Unable to validate promotion' };
      }
    }

    return { isApplicable: true, isApplied, couponApplicableMessage: '' };
  }

  async validateAll(promos: any[], input: CouponValidationInput): Promise<Map<string, CouponValidationResult>> {
    const results = new Map<string, CouponValidationResult>();
    await Promise.all(
      promos.map(async (promo) => {
        const result = await this.validate(promo, input);
        results.set(promo.id, result);
      }),
    );
    return results;
  }
}
