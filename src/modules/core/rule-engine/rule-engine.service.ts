import { Injectable } from '@nestjs/common';
import {
  RuleCondition,
  RuleConditionGroup,
  RuleDefinition,
  RuleEvaluationResult,
  RuleMatch,
  Award,
  FilterContext,
  SlabDefinition,
  MilestoneDefinition,
} from './rule-engine.types';

/**
 * Enterprise Rule Engine — Strategy Pattern for reward modes,
 * Specification Pattern for dynamic filter conditions.
 *
 * Supports: RATIO | ABSOLUTE | PERCENTAGE | MULTIPLIER | SLAB | MILESTONE
 * Filters: product, category, brand, merchant, BIN, channel, location, tier, etc.
 */
@Injectable()
export class RuleEngineService {
  /**
   * Evaluate a set of rule definitions against a context.
   * Returns matched rules and computed awards.
   */
  evaluateRules(
    rules: RuleDefinition[],
    context: FilterContext,
    transactionAmount?: number,
  ): RuleEvaluationResult {
    const sorted = [...rules].sort((a, b) => b.priority - a.priority);
    const rulesMatched: RuleMatch[] = [];
    const awards: Award[] = [];
    let totalAward = 0;

    for (const rule of sorted) {
      const match = this.evaluateSingleRule(rule, context);
      if (match) {
        rulesMatched.push(match);
        const award = this.computeReward(rule, transactionAmount ?? 0, context);
        if (award) {
          awards.push(award);
          totalAward += award.amount;
        }
      }
    }

    return { rulesMatched, awards, totalAward };
  }

  // ---- Condition Evaluation (Specification Pattern) ----

  private evaluateSingleRule(
    rule: RuleDefinition,
    context: FilterContext,
  ): RuleMatch | null {
    const matchedConditions: string[] = [];

    if (!rule.conditions || !rule.conditions.conditions) {
      return null;
    }

    const isMatch = this.evaluateConditionGroup(
      rule.conditions,
      context,
      matchedConditions,
    );

    if (!isMatch) return null;

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      rewardType: rule.rewardType,
      rewardMode: rule.rewardMode,
      value: rule.value,
      matchedConditions,
    };
  }

  private evaluateConditionGroup(
    group: RuleConditionGroup,
    context: FilterContext,
    matchedConditions: string[],
  ): boolean {
    if (!group.conditions || group.conditions.length === 0) return true;

    const results = group.conditions.map((cond) => {
      if ('operator' in cond && 'conditions' in cond) {
        return this.evaluateConditionGroup(
          cond as RuleConditionGroup,
          context,
          matchedConditions,
        );
      }
      return this.evaluateCondition(cond as RuleCondition, context, matchedConditions);
    });

    return group.operator === 'AND' ? results.every(Boolean) : results.some(Boolean);
  }

  private evaluateCondition(
    condition: RuleCondition,
    context: FilterContext,
    matchedConditions: string[],
  ): boolean {
    const fieldValue = this.resolveField(context, condition.field);
    const { operator, value } = condition;

    let result = false;
    switch (operator) {
      case 'eq':
        result = fieldValue === value;
        break;
      case 'neq':
        result = fieldValue !== value;
        break;
      case 'gt':
        result = Number(fieldValue) > Number(value);
        break;
      case 'gte':
        result = Number(fieldValue) >= Number(value);
        break;
      case 'lt':
        result = Number(fieldValue) < Number(value);
        break;
      case 'lte':
        result = Number(fieldValue) <= Number(value);
        break;
      case 'contains':
        result =
          typeof fieldValue === 'string' &&
          fieldValue.toLowerCase().includes(String(value).toLowerCase());
        break;
      case 'in':
        result = Array.isArray(value) && value.includes(fieldValue);
        break;
      case 'notIn':
        result = Array.isArray(value) && !value.includes(fieldValue);
        break;
      case 'regex':
        try {
          result = new RegExp(String(value)).test(String(fieldValue));
        } catch {
          result = false;
        }
        break;
      default:
        result = false;
    }

    if (result) {
      matchedConditions.push(`${condition.field} ${operator} ${value}`);
    }
    return result;
  }

  private resolveField(context: FilterContext, field: string): any {
    return field.split('.').reduce((obj, key) => {
      if (obj === null || obj === undefined) return undefined;
      return obj[key];
    }, context as any);
  }

  // ---- Reward Computation (Strategy Pattern) ----

  computeReward(
    rule: RuleDefinition,
    transactionAmount: number,
    context: FilterContext,
  ): Award | null {
    const { rewardMode, value, ratioBase, meta } = rule;
    let amount = 0;

    switch (rewardMode) {
      case 'RATIO':
        if (ratioBase && ratioBase > 0) {
          amount = Math.floor(transactionAmount / ratioBase) * value;
        }
        break;

      case 'ABSOLUTE':
        amount = value;
        break;

      case 'PERCENTAGE':
        amount = (transactionAmount * value) / 100;
        break;

      case 'MULTIPLIER':
        amount = (context.basePoints ?? 0) * value;
        break;

      case 'SLAB':
        amount = this.computeSlabReward(
          (meta?.slabs as SlabDefinition[]) ?? [],
          transactionAmount,
        );
        break;

      case 'MILESTONE':
        amount = this.computeMilestoneReward(
          (meta?.milestones as MilestoneDefinition[]) ?? [],
          context.cumulativeSpend ?? transactionAmount,
        );
        break;

      default:
        amount = 0;
    }

    if (amount <= 0) return null;

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      rewardType: rule.rewardType,
      rewardMode: rule.rewardMode,
      amount,
      currency: meta?.currency,
      meta,
    };
  }

  private computeSlabReward(slabs: SlabDefinition[], amount: number): number {
    for (const slab of slabs) {
      const min = slab.min;
      const max = slab.max ?? Infinity;
      if (amount >= min && amount <= max) {
        switch (slab.rewardMode) {
          case 'ABSOLUTE':
            return slab.value;
          case 'PERCENTAGE':
            return (amount * slab.value) / 100;
          case 'RATIO':
            return Math.floor(amount / (slab.value || 1));
          default:
            return slab.value;
        }
      }
    }
    return 0;
  }

  private computeMilestoneReward(
    milestones: MilestoneDefinition[],
    cumulativeAmount: number,
  ): number {
    let total = 0;
    for (const ms of milestones) {
      if (cumulativeAmount >= ms.threshold) {
        total += ms.value;
      }
    }
    return total;
  }
}
