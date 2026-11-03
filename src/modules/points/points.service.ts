import { Injectable } from '@nestjs/common';
import { RuleEngineService } from 'src/modules/rule-engine/rule-engine.service';
import { EligibilityEngineService } from 'src/modules/eligibility-engine/eligibility-engine.service';
import { BudgetEngineService } from 'src/modules/budget-engine/budget-engine.service';
import { EventEngineService } from 'src/modules/event-engine/event-engine.service';
import { AuditEngineService } from 'src/modules/audit-engine/audit-engine.service';
import { FilterContext, RuleDefinition } from 'src/modules/rule-engine/rule-engine.types';
import { EligibilityCriteria } from 'src/modules/eligibility-engine/eligibility-engine.service';
import { BudgetReservation } from 'src/modules/budget-engine/budget-engine.service';
import { AuditEntry } from 'src/modules/audit-engine/audit-engine.service';
import { RewardEventPayload } from 'src/modules/event-engine/event-engine.service';

@Injectable()
export class PointsService {
  constructor(
    private readonly ruleEngine: RuleEngineService,
    private readonly eligibilityEngine: EligibilityEngineService,
    private readonly budgetEngine: BudgetEngineService,
    private readonly eventEngine: EventEngineService,
    private readonly auditEngine: AuditEngineService,
  ) {}

  createProgram(program: any) {
    const auditEntry: AuditEntry = {
      entityType: 'RewardProgram',
      action: 'createProgram',
      details: { program },
    };
    this.auditEngine.log(auditEntry);
    return {
      success: true,
      program,
      message: 'Loyalty program created',
    };
  }

  findEligiblePrograms(context: FilterContext, criteria: EligibilityCriteria) {
    const eligibility = this.eligibilityEngine.evaluateEligibility(criteria, context);
    const rules: RuleDefinition[] = []; // rules would come from DB
    const ruleResult = this.ruleEngine.evaluateRules(rules, context);

    return {
      eligible: eligibility.eligible,
      reasons: eligibility.reasons,
      awards: ruleResult.awards,
      rulesMatched: ruleResult.rulesMatched,
    };
  }

  calculateRewards(context: FilterContext, criteria: EligibilityCriteria, rules: RuleDefinition[]) {
    const eligibility = this.eligibilityEngine.evaluateEligibility(criteria, context);
    if (!eligibility.eligible) {
      return {
        eligible: false,
        reasons: eligibility.reasons,
      };
    }

    const ruleResult = this.ruleEngine.evaluateRules(rules, context);

    const auditEntry: AuditEntry = {
      entityType: 'RewardCalculation',
      action: 'calculateRewards',
      details: { context, ruleResult },
    };
    this.auditEngine.log(auditEntry);

    return {
      eligible: true,
      awards: ruleResult.awards,
      rulesMatched: ruleResult.rulesMatched,
    };
  }

  async blockRewards(
    context: FilterContext,
    criteria: EligibilityCriteria,
    rules: RuleDefinition[],
    budgetReservation: BudgetReservation,
  ) {
    const eligibility = this.eligibilityEngine.evaluateEligibility(criteria, context);
    const ruleResult = this.ruleEngine.evaluateRules(rules, context);
    const budgetResult = await this.budgetEngine.reserveBudget(budgetReservation);

    const auditEntry: AuditEntry = {
      entityType: 'RewardBlock',
      action: 'blockRewards',
      details: { context, ruleResult, budgetResult },
    };
    this.auditEngine.log(auditEntry);

    const eventPayload: RewardEventPayload = {
      programId: budgetReservation.programId,
      customerId: context.customerId ?? 'unknown',
      rewardType: 'points',
      amount: ruleResult.totalAward,
      blockRef: `block_${Date.now()}`,
      transactionRef: budgetReservation.reference,
      meta: { ruleResult, budgetResult },
      timestamp: new Date().toISOString(),
    };
    this.eventEngine.publish('reward.blocked', eventPayload);

    return {
      blocked: eligibility.eligible,
      blockId: `block_${Date.now()}`,
      awards: ruleResult.awards,
      budget: budgetResult,
    };
  }

  async awardRewards(
    context: FilterContext,
    rules: RuleDefinition[],
    budgetReservation: BudgetReservation,
  ) {
    const ruleResult = this.ruleEngine.evaluateRules(rules, context);
    const budgetResult = await this.budgetEngine.reserveBudget(budgetReservation);

    const auditEntry: AuditEntry = {
      entityType: 'RewardAward',
      action: 'awardRewards',
      details: { context, ruleResult, budgetResult },
    };
    this.auditEngine.log(auditEntry);

    const eventPayload: RewardEventPayload = {
      programId: budgetReservation.programId,
      customerId: context.customerId ?? 'unknown',
      rewardType: 'points',
      amount: ruleResult.totalAward,
      transactionRef: budgetReservation.reference,
      meta: { ruleResult, budgetResult },
      timestamp: new Date().toISOString(),
    };
    this.eventEngine.publish('reward.awarded', eventPayload);

    return {
      awarded: true,
      awards: ruleResult.awards,
      budget: budgetResult,
    };
  }

  async reverseRewards(referenceId: string, programId: string, customerId: string) {
    const auditEntry: AuditEntry = {
      entityType: 'RewardReversal',
      action: 'reverseRewards',
      details: { referenceId, programId, customerId },
    };
    this.auditEngine.log(auditEntry);

    const eventPayload: RewardEventPayload = {
      programId,
      customerId,
      rewardType: 'points',
      amount: 0,
      transactionRef: referenceId,
      meta: { referenceId },
      timestamp: new Date().toISOString(),
    };
    this.eventEngine.publish('reward.reversed', eventPayload);

    return {
      reversed: true,
      referenceId,
    };
  }

  async expireRewards(programId: string, customerId: string, amount: number) {
    const auditEntry: AuditEntry = {
      entityType: 'RewardExpiry',
      action: 'expireRewards',
      details: { programId, customerId, amount },
    };
    this.auditEngine.log(auditEntry);

    const eventPayload: RewardEventPayload = {
      programId,
      customerId,
      rewardType: 'points',
      amount,
      meta: { expiredOn: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    };
    this.eventEngine.publish('reward.expired', eventPayload);

    return {
      expired: true,
      expiredOn: new Date().toISOString(),
    };
  }
}
