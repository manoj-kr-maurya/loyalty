import { Injectable } from '@nestjs/common';
import { FilterContext, RuleConditionGroup } from '../rule-engine/rule-engine.types';
import { RuleEngineService } from '../rule-engine/rule-engine.service';

export interface EligibilityCriteria {
  conditions?: RuleConditionGroup;
  startDate?: Date;
  endDate?: Date;
  timezone?: string;
  blackoutDates?: string[];   // ISO date strings
  workingDays?: number[];     // 0=Sun … 6=Sat
  dailyTimeSlots?: { start: string; end: string }[]; // "HH:mm"
  minTransactions?: number;
  maxTransactions?: number;
  customerTiers?: string[];
  minTransactionAmount?: number;
  maxTransactionAmount?: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

/**
 * Eligibility Engine — evaluates whether a customer/transaction
 * qualifies for a program or promotion.
 *
 * Checks: date range, blackout dates, working days, time slots,
 * transaction limits, tier eligibility, and custom filter conditions.
 */
@Injectable()
export class EligibilityEngineService {
  constructor(private readonly ruleEngine: RuleEngineService) {}

  evaluateEligibility(
    criteria: EligibilityCriteria,
    context: FilterContext,
  ): EligibilityResult {
    const reasons: string[] = [];

    // 1. Date range check
    if (criteria.startDate || criteria.endDate) {
      const now = new Date();
      if (criteria.startDate && now < new Date(criteria.startDate)) {
        reasons.push('Program has not started yet');
      }
      if (criteria.endDate && now > new Date(criteria.endDate)) {
        reasons.push('Program has ended');
      }
    }

    // 2. Blackout dates
    if (criteria.blackoutDates?.length) {
      const today = this.todayInTimezone(criteria.timezone);
      if (criteria.blackoutDates.includes(today)) {
        reasons.push('Today is a blackout date');
      }
    }

    // 3. Working days
    if (criteria.workingDays?.length) {
      const dayOfWeek = new Date().getDay();
      if (!criteria.workingDays.includes(dayOfWeek)) {
        reasons.push('Today is not a working day for this program');
      }
    }

    // 4. Daily time slots
    if (criteria.dailyTimeSlots?.length) {
      const now = this.nowInTimezone(criteria.timezone);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const inSlot = criteria.dailyTimeSlots.some((slot) => {
        const [sh, sm] = slot.start.split(':').map(Number);
        const [eh, em] = slot.end.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        return currentMinutes >= startMin && currentMinutes <= endMin;
      });
      if (!inSlot) {
        reasons.push('Current time is outside allowed time slots');
      }
    }

    // 5. Transaction count limits
    if (criteria.minTransactions != null || criteria.maxTransactions != null) {
      const txCount = context.transactionCount ?? 0;
      if (criteria.minTransactions != null && txCount < criteria.minTransactions) {
        reasons.push('Customer has not met minimum transaction count');
      }
      if (criteria.maxTransactions != null && txCount > criteria.maxTransactions) {
        reasons.push('Customer has exceeded maximum transaction count');
      }
    }

    // 6. Transaction amount limits
    if (criteria.minTransactionAmount != null || criteria.maxTransactionAmount != null) {
      const txAmount = context.transactionAmount ?? 0;
      if (criteria.minTransactionAmount != null && txAmount < criteria.minTransactionAmount) {
        reasons.push('Transaction amount below minimum');
      }
      if (criteria.maxTransactionAmount != null && txAmount > criteria.maxTransactionAmount) {
        reasons.push('Transaction amount above maximum');
      }
    }

    // 7. Customer tier check
    if (criteria.customerTiers?.length) {
      const tier = context.customerTier ?? 'default';
      if (!criteria.customerTiers.includes(tier)) {
        reasons.push('Customer tier not eligible');
      }
    }

    // 8. Custom filter conditions (delegated to RuleEngine)
    if (criteria.conditions) {
      const match = this.ruleEngine.evaluateRules(
        [
          {
            id: 'eligibility',
            name: 'EligibilityCheck',
            conditions: criteria.conditions,
            rewardType: 'POINTS',
            rewardMode: 'ABSOLUTE',
            value: 0,
            priority: 0,
          },
        ],
        context,
      );
      if (match.rulesMatched.length === 0) {
        reasons.push('Custom eligibility conditions not met');
      }
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  private todayInTimezone(tz?: string): string {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  private nowInTimezone(tz?: string): Date {
    return new Date();
  }
}
