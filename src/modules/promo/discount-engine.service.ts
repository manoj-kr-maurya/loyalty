import { Injectable, Logger } from '@nestjs/common';
import { Award, RuleEvaluationResult } from '../rule-engine/rule-engine.types';

export interface DiscountInput {
  /** The original transaction amount before any discount. */
  transactionAmount: number;
  /** The currency of the transaction (e.g., INR, USD). */
  currency: string;
  /** The awards from rule evaluation that need to be converted to discounts. */
  awards: Award[];
  /** Optional: max discount cap (absolute or percentage). */
  maxDiscount?: { type: 'ABSOLUTE' | 'PERCENTAGE'; value: number };
}

export interface DiscountLine {
  ruleId: string;
  ruleName: string;
  rewardType: string;
  /** The computed discount amount in the transaction currency. */
  discountAmount: number;
  /** The discount as a percentage of the transaction amount. */
  discountPercentage: number;
  /** The currency of the discount. */
  currency: string;
  /** Description for receipt/display. */
  description: string;
}

export interface DiscountResult2 {
  /** Individual discount lines. */
  discounts: DiscountLine[];
  /** Total discount amount. */
  totalDiscount: number;
  /** Final amount after all discounts. */
  finalAmount: number;
  /** Whether the discount was capped. */
  wasCapped: boolean;
  /** The cap that was applied, if any. */
  capApplied?: { type: 'ABSOLUTE' | 'PERCENTAGE'; value: number };
}

/**
 * Discount Engine — computes the actual discount or reward
 * from rule evaluation results.
 *
 * Handles:
 * - ABSOLUTE: Fixed discount amount.
 * - PERCENTAGE: Percentage of transaction amount.
 * - RATIO: Points per currency unit (e.g., 5 points per ₹100).
 * - MULTIPLIER: Multiplier on base points.
 * - SLAB/MILESTONE: Already computed by RuleEngine, treated as absolute.
 * - Discount capping (max absolute or percentage cap).
 */
@Injectable()
export class DiscountEngineService {
  private readonly logger = new Logger(DiscountEngineService.name);

  /**
   * Compute discounts from rule evaluation results.
   */
  compute(
    transactionAmount: number,
    currency: string,
    awards: RuleEvaluationResult[],
    maxDiscount?: { amount: number; percentage: number },
  ): DiscountResult2 {
    const discounts: DiscountLine[] = [];

    for (const result of awards) {
      for (const award of result.awards) {
        const discount = this.awardToDiscount(award, transactionAmount, currency);
        discounts.push(discount);
      }
    }

    let totalDiscount = discounts.reduce((sum, d) => sum + d.discountAmount, 0);

    // Apply caps
    let wasCapped = false;
    let capApplied: { type: 'ABSOLUTE' | 'PERCENTAGE'; value: number } | undefined;

    if (maxDiscount) {
      // Absolute cap
      if (maxDiscount.amount > 0 && totalDiscount > maxDiscount.amount) {
        wasCapped = true;
        capApplied = { type: 'ABSOLUTE', value: maxDiscount.amount };
        totalDiscount = maxDiscount.amount;
      }

      // Percentage cap
      const pctCap = (maxDiscount.percentage / 100) * transactionAmount;
      if (maxDiscount.percentage > 0 && totalDiscount > pctCap) {
        wasCapped = true;
        capApplied = { type: 'PERCENTAGE', value: maxDiscount.percentage };
        totalDiscount = pctCap;
      }
    }

    const finalAmount = Math.max(0, transactionAmount - totalDiscount);

    this.logger.log(
      `Discount computed: total=${totalDiscount}, final=${finalAmount}, capped=${wasCapped}`,
    );

    return {
      discounts,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      finalAmount: Math.round(finalAmount * 100) / 100,
      wasCapped,
      capApplied,
    };
  }

  /**
   * Convert a single award to a discount line.
   */
  private awardToDiscount(
    award: Award,
    transactionAmount: number,
    currency: string,
  ): DiscountLine {
    let discountAmount: number;

    switch (award.rewardMode) {
      case 'ABSOLUTE':
        discountAmount = award.amount;
        break;

      case 'PERCENTAGE':
        discountAmount = (award.amount / 100) * transactionAmount;
        break;

      case 'RATIO': {
        // award.amount = points per ratioBase units of spend.
        // e.g. 5 points per ₹100 -> discountAmount = (txnAmount / 100) * 5.
        const ratioBase = (award.meta as { ratioBase?: number } | undefined)
          ?.ratioBase;
        discountAmount =
          ratioBase && ratioBase > 0
            ? (transactionAmount / ratioBase) * award.amount
            : award.amount;
        break;
      }

      case 'MULTIPLIER': {
        // award.amount is a multiplier (e.g. 2x) applied to a base.
        // base defaults to the transaction amount unless supplied in meta.
        const base = (award.meta as { base?: number } | undefined)?.base;
        discountAmount = (base ?? transactionAmount) * award.amount;
        break;
      }

      case 'SLAB':
      case 'MILESTONE':
        // Already computed by Rule Engine
        discountAmount = award.amount;
        break;

      default:
        discountAmount = award.amount;
    }

    const discountPercentage =
      transactionAmount > 0
        ? Math.round((discountAmount / transactionAmount) * 10000) / 100
        : 0;

    return {
      ruleId: award.ruleId,
      ruleName: award.ruleName,
      rewardType: award.rewardType,
      discountAmount: Math.round(discountAmount * 100) / 100,
      discountPercentage,
      currency: award.currency ?? currency,
      description: this.buildDescription(award, discountAmount, currency),
    };
  }

  /**
   * Build a human-readable description for the discount.
   */
  private buildDescription(award: Award, amount: number, currency: string): string {
    switch (award.rewardMode) {
      case 'ABSOLUTE':
        return `${award.ruleName}: Flat ${currency} ${amount} off`;
      case 'PERCENTAGE':
        return `${award.ruleName}: ${award.amount}% off (${currency} ${amount})`;
      case 'RATIO':
        return `${award.ruleName}: ${amount} ${award.rewardType} earned`;
      case 'MULTIPLIER':
        return `${award.ruleName}: ${amount}x ${award.rewardType}`;
      default:
        return `${award.ruleName}: ${currency} ${amount}`;
    }
  }
}