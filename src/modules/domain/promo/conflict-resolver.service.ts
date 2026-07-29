import { Injectable, Logger } from '@nestjs/common';
import { PromotionRecord } from './promotion-repository.service';
import { RuleEvaluationResult } from '../../core/rule-engine/rule-engine.types';

export type ConflictStrategy = 'PRIORITY' | 'EXCLUSIVE' | 'STACKABLE';

export interface ConflictResolution {
  /** Promotions that won the conflict and should be applied. */
  winners: PromotionRecord[];
  /** Promotions that were excluded due to conflict rules. */
  excluded: { promotion: PromotionRecord; reason: string }[];
  /** The resolved awards from winning promotions. */
  resolvedAwards: RuleEvaluationResult[];
}

export interface ConflictConfig {
  /** Default strategy when no explicit strategy is set on a promotion. */
  defaultStrategy: ConflictStrategy;
  /** Max number of promotions that can stack. Ignored for PRIORITY/EXCLUSIVE. */
  maxStackable?: number;
}

/**
 * Conflict Resolver — handles priority, exclusive, and stackable rules
 * when multiple promotions match a single transaction.
 *
 * Strategies:
 * - PRIORITY: Only the highest-priority promotion wins.
 * - EXCLUSIVE: The first matching promotion wins; all others are excluded.
 * - STACKABLE: Multiple promotions can apply, up to maxStackable.
 */
@Injectable()
export class ConflictResolverService {
  private readonly logger = new Logger(ConflictResolverService.name);

  /**
   * Resolve conflicts among a set of eligible promotions.
   *
   * @param promotions - Eligible promotions with their evaluation results.
   * @param config - Conflict resolution configuration.
   * @returns Resolved winners, excluded promotions, and final awards.
   */
  resolve(
    promotions: { promotion: PromotionRecord; result: RuleEvaluationResult }[],
    config: ConflictConfig = { defaultStrategy: 'PRIORITY', maxStackable: 3 },
  ): ConflictResolution {
    if (promotions.length === 0) {
      return { winners: [], excluded: [], resolvedAwards: [] };
    }

    if (promotions.length === 1) {
      return {
        winners: [promotions[0].promotion],
        excluded: [],
        resolvedAwards: [promotions[0].result],
      };
    }

    // Sort by priority descending (higher priority first)
    const sorted = [...promotions].sort(
      (a, b) => b.promotion.priority - a.promotion.priority,
    );

    const strategy = config.defaultStrategy;
    const winners: PromotionRecord[] = [];
    const excluded: { promotion: PromotionRecord; reason: string }[] = [];
    const resolvedAwards: RuleEvaluationResult[] = [];

    switch (strategy) {
      case 'PRIORITY':
        this.resolveByPriority(sorted, winners, excluded, resolvedAwards);
        break;
      case 'EXCLUSIVE':
        this.resolveExclusive(sorted, winners, excluded, resolvedAwards);
        break;
      case 'STACKABLE':
        this.resolveStackable(sorted, config.maxStackable ?? 3, winners, excluded, resolvedAwards);
        break;
      default:
        this.resolveByPriority(sorted, winners, excluded, resolvedAwards);
    }

    this.logger.log(
      `Conflict resolved: ${winners.length} winners, ${excluded.length} excluded (strategy=${strategy})`,
    );

    return { winners, excluded, resolvedAwards };
  }

  /**
   * PRIORITY strategy: only the highest-priority promotion wins.
   * If multiple have the same top priority, all of them win.
   */
  private resolveByPriority(
    sorted: { promotion: PromotionRecord; result: RuleEvaluationResult }[],
    winners: PromotionRecord[],
    excluded: { promotion: PromotionRecord; reason: string }[],
    resolvedAwards: RuleEvaluationResult[],
  ): void {
    const topPriority = sorted[0].promotion.priority;

    for (const item of sorted) {
      if (item.promotion.priority === topPriority) {
        winners.push(item.promotion);
        resolvedAwards.push(item.result);
      } else {
        excluded.push({
          promotion: item.promotion,
          reason: `Lower priority (${item.promotion.priority} < ${topPriority})`,
        });
      }
    }
  }

  /**
   * EXCLUSIVE strategy: Only the first matching promotion wins.
   * All others are excluded regardless of priority.
   */
  private resolveExclusive(
    sorted: { promotion: PromotionRecord; result: RuleEvaluationResult }[],
    winners: PromotionRecord[],
    excluded: { promotion: PromotionRecord; reason: string }[],
    resolvedAwards: RuleEvaluationResult[],
  ): void {
    const first = sorted[0];
    winners.push(first.promotion);
    resolvedAwards.push(first.result);

    for (let i = 1; i < sorted.length; i++) {
      excluded.push({
        promotion: sorted[i].promotion,
        reason: `Excluded by exclusive promotion "${first.promotion.name}"`,
      });
    }
  }

  /**
   * STACKABLE strategy: Multiple promotions can apply, up to maxStackable.
   * Promotions beyond the limit are excluded.
   */
  private resolveStackable(
    sorted: { promotion: PromotionRecord; result: RuleEvaluationResult }[],
    maxStackable: number,
    winners: PromotionRecord[],
    excluded: { promotion: PromotionRecord; reason: string }[],
    resolvedAwards: RuleEvaluationResult[],
  ): void {
    for (let i = 0; i < sorted.length; i++) {
      if (i < maxStackable) {
        winners.push(sorted[i].promotion);
        resolvedAwards.push(sorted[i].result);
      } else {
        excluded.push({
          promotion: sorted[i].promotion,
          reason: `Stackable limit reached (max ${maxStackable})`,
        });
      }
    }
  }
}