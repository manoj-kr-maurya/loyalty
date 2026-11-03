import { Test, TestingModule } from '@nestjs/testing';
import { PointsService } from './points.service';
import { RuleEngineService } from 'src/modules/rule-engine/rule-engine.service';
import { EligibilityEngineService } from 'src/modules/eligibility-engine/eligibility-engine.service';
import { BudgetEngineService } from 'src/modules/budget-engine/budget-engine.service';
import { EventEngineService } from 'src/modules/event-engine/event-engine.service';
import { AuditEngineService } from 'src/modules/audit-engine/audit-engine.service';
import { FilterContext } from 'src/modules/rule-engine/rule-engine.types';
import { EligibilityCriteria } from 'src/modules/eligibility-engine/eligibility-engine.service';
import { BudgetReservation } from 'src/modules/budget-engine/budget-engine.service';

describe('PointsService', () => {
  let service: PointsService;
  let ruleEngine: jest.Mocked<RuleEngineService>;
  let eligibilityEngine: jest.Mocked<EligibilityEngineService>;
  let budgetEngine: jest.Mocked<BudgetEngineService>;
  let eventEngine: jest.Mocked<EventEngineService>;
  let auditEngine: jest.Mocked<AuditEngineService>;

  const mockContext: FilterContext = {
    customerId: 'cust-1',
    organizationId: 'org-1',
    transactionAmount: 500,
    currency: 'INR',
    channel: 'WEB',
    product: 'electronics',
    category: 'phones',
  };

  const mockCriteria: EligibilityCriteria = {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-12-31'),
    timezone: 'UTC',
  };

  const mockRules = [
    {
      id: 'rule-1',
      name: 'Phone Bonus',
      conditions: {
        operator: 'AND' as const,
        conditions: [{ field: 'category', operator: 'eq' as const, value: 'phones' }],
      },
      rewardType: 'POINTS',
      rewardMode: 'PERCENTAGE' as const,
      value: 5,
      priority: 10,
    },
  ];

  const mockRuleResult = {
    rulesMatched: [
      {
        ruleId: 'rule-1',
        ruleName: 'Phone Bonus',
        rewardType: 'POINTS',
        rewardMode: 'PERCENTAGE' as const,
        value: 5,
        matchedConditions: ['category eq phones'],
      },
    ],
    awards: [
      {
        ruleId: 'rule-1',
        ruleName: 'Phone Bonus',
        rewardType: 'POINTS',
        rewardMode: 'PERCENTAGE' as const,
        amount: 25,
        currency: 'INR',
      },
    ],
    totalAward: 25,
  };

  const mockBudgetResult = {
    reserved: true,
    remainingBudget: 9750,
    totalBudget: 10000,
    usedBudget: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        {
          provide: RuleEngineService,
          useFactory: () => ({
            evaluateRules: jest.fn().mockReturnValue(mockRuleResult),
          }),
        },
        {
          provide: EligibilityEngineService,
          useFactory: () => ({
            evaluateEligibility: jest.fn().mockReturnValue({
              eligible: true,
              reasons: [],
            }),
          }),
        },
        {
          provide: BudgetEngineService,
          useFactory: () => ({
            reserveBudget: jest.fn().mockResolvedValue(mockBudgetResult),
          }),
        },
        {
          provide: EventEngineService,
          useFactory: () => ({
            publish: jest.fn(),
          }),
        },
        {
          provide: AuditEngineService,
          useFactory: () => ({
            log: jest.fn().mockResolvedValue(undefined),
          }),
        },
      ],
    }).compile();

    service = module.get<PointsService>(PointsService);
    ruleEngine = module.get(RuleEngineService);
    eligibilityEngine = module.get(EligibilityEngineService);
    budgetEngine = module.get(BudgetEngineService);
    eventEngine = module.get(EventEngineService);
    auditEngine = module.get(AuditEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProgram', () => {
    it('should create a program and return success', () => {
      const program = {
        name: 'Phone Rewards',
        description: 'Earn on phone purchases',
        rewardCurrency: 'PTS',
        status: 'ACTIVE',
        budgetEnabled: true,
        priority: 10,
        programType: 'LOYALTY',
      };

      const result = service.createProgram(program);

      expect(result.success).toBe(true);
      expect(result.program).toEqual(program);
      expect(result.message).toBe('Loyalty program created');
      expect(auditEngine.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'RewardProgram',
          action: 'createProgram',
        }),
      );
    });

    it('should include program details in audit entry', () => {
      const program = { name: 'Test Program', id: 'prog-1' };
      service.createProgram(program);

      expect(auditEngine.log).toHaveBeenCalledWith(
        expect.objectContaining({
          details: { program },
        }),
      );
    });
  });

  describe('findEligiblePrograms', () => {
    it('should return eligibility result with reasons when ineligible', () => {
      eligibilityEngine.evaluateEligibility.mockReturnValue({
        eligible: false,
        reasons: ['Program has ended'],
      });

      const result = service.findEligiblePrograms(mockContext, mockCriteria);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('Program has ended');
      expect(eligibilityEngine.evaluateEligibility).toHaveBeenCalledWith(
        mockCriteria,
        mockContext,
      );
    });

    it('should return eligible result with awards when criteria match', () => {
      const result = service.findEligiblePrograms(mockContext, mockCriteria);

      expect(result.eligible).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.awards).toEqual(mockRuleResult.awards);
      expect(result.rulesMatched).toEqual(mockRuleResult.rulesMatched);
    });

    it('should call rule engine to evaluate rules', () => {
      service.findEligiblePrograms(mockContext, mockCriteria);

      expect(ruleEngine.evaluateRules).toHaveBeenCalledWith([], mockContext);
    });
  });

  describe('calculateRewards', () => {
    it('should return eligible result with awards', () => {
      const result = service.calculateRewards(mockContext, mockCriteria, mockRules);

      expect(result.eligible).toBe(true);
      expect(result.awards).toEqual(mockRuleResult.awards);
      expect(result.rulesMatched).toEqual(mockRuleResult.rulesMatched);
    });

    it('should return ineligible result when eligibility fails', () => {
      eligibilityEngine.evaluateEligibility.mockReturnValue({
        eligible: false,
        reasons: ['Customer tier not eligible'],
      });

      const result = service.calculateRewards(mockContext, mockCriteria, mockRules);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('Customer tier not eligible');
      expect(ruleEngine.evaluateRules).not.toHaveBeenCalled();
    });

    it('should log audit entry for successful calculation', () => {
      service.calculateRewards(mockContext, mockCriteria, mockRules);

      expect(auditEngine.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'RewardCalculation',
          action: 'calculateRewards',
        }),
      );
    });
  });

  describe('blockRewards', () => {
    const mockBudgetReservation: BudgetReservation = {
      programId: 'prog-1',
      amount: 25,
      currency: 'INR',
      reference: 'txn-123',
    };

    it('should block rewards and return block details', async () => {
      const result = await service.blockRewards(
        mockContext,
        mockCriteria,
        mockRules,
        mockBudgetReservation,
      );

      expect(result.blocked).toBe(true);
      expect(result.blockId).toMatch(/^block_/);
      expect(result.awards).toEqual(mockRuleResult.awards);
      expect(result.budget).toEqual(mockBudgetResult);
    });

    it('should reserve budget through budget engine', async () => {
      await service.blockRewards(
        mockContext,
        mockCriteria,
        mockRules,
        mockBudgetReservation,
      );

      expect(budgetEngine.reserveBudget).toHaveBeenCalledWith(mockBudgetReservation);
    });

    it('should publish reward.blocked event', async () => {
      await service.blockRewards(
        mockContext,
        mockCriteria,
        mockRules,
        mockBudgetReservation,
      );

      expect(eventEngine.publish).toHaveBeenCalledWith(
        'reward.blocked',
        expect.objectContaining({
          programId: 'prog-1',
          customerId: 'cust-1',
          rewardType: 'points',
          amount: 25,
        }),
      );
    });

    it('should log audit entry for block', async () => {
      await service.blockRewards(
        mockContext,
        mockCriteria,
        mockRules,
        mockBudgetReservation,
      );

      expect(auditEngine.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'RewardBlock',
          action: 'blockRewards',
        }),
      );
    });

    it('should use unknown when customerId is missing', async () => {
      const ctxNoCustomer: FilterContext = { transactionAmount: 100 };
      await service.blockRewards(
        ctxNoCustomer,
        mockCriteria,
        mockRules,
        mockBudgetReservation,
      );

      expect(eventEngine.publish).toHaveBeenCalledWith(
        'reward.blocked',
        expect.objectContaining({ customerId: 'unknown' }),
      );
    });
  });

  describe('awardRewards', () => {
    const mockBudgetReservation: BudgetReservation = {
      programId: 'prog-1',
      amount: 25,
      currency: 'INR',
      reference: 'txn-456',
    };

    it('should award rewards and return success', async () => {
      const result = await service.awardRewards(mockContext, mockRules, mockBudgetReservation);

      expect(result.awarded).toBe(true);
      expect(result.awards).toEqual(mockRuleResult.awards);
      expect(result.budget).toEqual(mockBudgetResult);
    });

    it('should publish reward.awarded event', async () => {
      await service.awardRewards(mockContext, mockRules, mockBudgetReservation);

      expect(eventEngine.publish).toHaveBeenCalledWith(
        'reward.awarded',
        expect.objectContaining({
          programId: 'prog-1',
          customerId: 'cust-1',
          amount: 25,
        }),
      );
    });

    it('should log audit for award', async () => {
      await service.awardRewards(mockContext, mockRules, mockBudgetReservation);

      expect(auditEngine.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'RewardAward',
          action: 'awardRewards',
        }),
      );
    });
  });

  describe('reverseRewards', () => {
    it('should reverse rewards and return reversed status', async () => {
      const result = await service.reverseRewards('ref-1', 'prog-1', 'cust-1');

      expect(result.reversed).toBe(true);
      expect(result.referenceId).toBe('ref-1');
    });

    it('should publish reward.reversed event', async () => {
      await service.reverseRewards('ref-1', 'prog-1', 'cust-1');

      expect(eventEngine.publish).toHaveBeenCalledWith(
        'reward.reversed',
        expect.objectContaining({
          programId: 'prog-1',
          customerId: 'cust-1',
          transactionRef: 'ref-1',
        }),
      );
    });

    it('should log audit for reversal', async () => {
      await service.reverseRewards('ref-1', 'prog-1', 'cust-1');

      expect(auditEngine.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'RewardReversal',
          action: 'reverseRewards',
          details: { referenceId: 'ref-1', programId: 'prog-1', customerId: 'cust-1' },
        }),
      );
    });
  });

  describe('expireRewards', () => {
    it('should expire rewards and return expiry confirmation', async () => {
      const result = await service.expireRewards('prog-1', 'cust-1', 50);

      expect(result.expired).toBe(true);
      expect(result.expiredOn).toBeDefined();
    });

    it('should publish reward.expired event with correct payload', async () => {
      await service.expireRewards('prog-1', 'cust-1', 50);

      expect(eventEngine.publish).toHaveBeenCalledWith(
        'reward.expired',
        expect.objectContaining({
          programId: 'prog-1',
          customerId: 'cust-1',
          amount: 50,
          rewardType: 'points',
        }),
      );
    });

    it('should log audit for expiry', async () => {
      await service.expireRewards('prog-1', 'cust-1', 100);

      expect(auditEngine.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'RewardExpiry',
          action: 'expireRewards',
          details: { programId: 'prog-1', customerId: 'cust-1', amount: 100 },
        }),
      );
    });
  });
});
