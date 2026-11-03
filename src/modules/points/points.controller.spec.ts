import { Test, TestingModule } from '@nestjs/testing';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { ConfigService } from '@nestjs/config';
import { OrganizationApiKeyGuard } from 'src/modules/auth/guards/organization-api-key.guard';

describe('PointsController', () => {
  let controller: PointsController;
  let pointsService: jest.Mocked<PointsService>;

  const mockProgram = {
    success: true,
    program: { name: 'Test Program', id: 'prog-1' },
    message: 'Loyalty program created',
  };

  const mockEligibleResult = {
    eligible: true,
    reasons: [],
    awards: [
      {
        ruleId: 'rule-1',
        ruleName: 'Test Rule',
        rewardType: 'POINTS',
        rewardMode: 'PERCENTAGE',
        amount: 25,
        currency: 'INR',
      },
    ],
    rulesMatched: [
      {
        ruleId: 'rule-1',
        ruleName: 'Test Rule',
        rewardType: 'POINTS',
        rewardMode: 'PERCENTAGE',
        value: 5,
        matchedConditions: ['category eq phones'],
      },
    ],
  };

  const mockCalcResult = {
    eligible: true,
    awards: mockEligibleResult.awards,
    rulesMatched: mockEligibleResult.rulesMatched,
  };

  const mockBlockResult = {
    blocked: true,
    blockId: 'block_1234',
    awards: mockEligibleResult.awards,
    budget: {
      reserved: true,
      remainingBudget: 9750,
      totalBudget: 10000,
      usedBudget: 0,
    },
  };

  const mockAwardResult = {
    awarded: true,
    awards: mockEligibleResult.awards,
    budget: mockBlockResult.budget,
  };

  const mockReverseResult = {
    reversed: true,
    referenceId: 'ref-1',
  };

  const mockExpireResult = {
    expired: true,
    expiredOn: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PointsController],
      providers: [
        {
          provide: PointsService,
          useFactory: () => ({
            createProgram: jest.fn().mockResolvedValue(mockProgram),
            findEligiblePrograms: jest.fn().mockReturnValue(mockEligibleResult),
            calculateRewards: jest.fn().mockReturnValue(mockCalcResult),
            blockRewards: jest.fn().mockResolvedValue(mockBlockResult),
            awardRewards: jest.fn().mockResolvedValue(mockAwardResult),
            reverseRewards: jest.fn().mockResolvedValue(mockReverseResult),
            expireRewards: jest.fn().mockResolvedValue(mockExpireResult),
          }),
        },
        {
          provide: ConfigService,
          useFactory: () => ({
            get: jest.fn().mockReturnValue('test-api-key'),
          }),
        },
      ],
    })
      .overrideGuard(OrganizationApiKeyGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<PointsController>(PointsController);
    pointsService = module.get(PointsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createProgram', () => {
    it('should call service and return success', async () => {
      const form = {
        name: 'Phone Rewards',
        description: 'Earn on phone purchases',
        rewardCurrency: 'PTS',
        status: 'ACTIVE',
        budgetEnabled: true,
        expiryNotification: false,
        priority: 10,
        programType: 'LOYALTY',
        business: 'electronics',
        category: 'phones',
      };

      const result = await controller.createProgram(form as any);

      expect(result).toEqual(mockProgram);
      expect(pointsService.createProgram).toHaveBeenCalledWith(form);
    });

    it('should return response with status and data pattern', async () => {
      const result = await controller.createProgram({} as any);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('program');
      expect(result).toHaveProperty('message');
    });
  });

  describe('findEligiblePrograms', () => {
    it('should return matching programs', async () => {
      const body = {
        customer: { id: 'cust-1' },
        cart: { amount: 500 },
        payment: { method: 'card' },
        merchant: { id: 'merch-1' },
        channel: 'WEB',
        location: { city: 'Mumbai' },
      };

      const result = await controller.findEligiblePrograms(body as any);

      expect(result).toEqual(mockEligibleResult);
      expect(pointsService.findEligiblePrograms).toHaveBeenCalled();
    });

    it('should return eligible flag and awards', async () => {
      const result = await controller.findEligiblePrograms({} as any);

      expect(result).toHaveProperty('eligible');
      expect(result).toHaveProperty('awards');
      expect(result).toHaveProperty('rulesMatched');
    });
  });

  describe('calculateRewards', () => {
    it('should return calculated rewards', async () => {
      const body = {
        customer: { id: 'cust-1' },
        cart: { amount: 500 },
        rules: [
          {
            id: 'rule-1',
            name: 'Test',
            conditions: { operator: 'AND', conditions: [] },
            rewardType: 'POINTS',
            rewardMode: 'PERCENTAGE',
            value: 5,
            priority: 1,
          },
        ],
      };

      const result = await controller.calculateRewards(body as any);

      expect(result).toEqual(mockCalcResult);
      expect(pointsService.calculateRewards).toHaveBeenCalled();
    });

    it('should default rules to empty array when not provided', async () => {
      await controller.calculateRewards({ customer: {} } as any);

      expect(pointsService.calculateRewards).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        [],
      );
    });
  });

  describe('blockRewards', () => {
    it('should block rewards and return block details', async () => {
      const body = {
        customer: { id: 'cust-1' },
        cart: { amount: 500 },
        programId: 'prog-1',
        amount: 25,
        currency: 'INR',
        reference: 'txn-123',
      };

      const result = await controller.blockRewards(body as any);

      expect(result).toEqual(mockBlockResult);
      expect(pointsService.blockRewards).toHaveBeenCalled();
    });

    it('should build budgetReservation from body fields', async () => {
      const body = {
        programId: 'prog-2',
        amount: 50,
        currency: 'USD',
        reference: 'txn-456',
      };

      await controller.blockRewards(body as any);

      expect(pointsService.blockRewards).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        [],
        expect.objectContaining({
          programId: 'prog-2',
          amount: 50,
          currency: 'USD',
          reference: 'txn-456',
        }),
      );
    });
  });

  describe('awardRewards', () => {
    it('should award rewards and return confirmation', async () => {
      const body = {
        blockId: 'block_1234',
        payment: { status: 'completed' },
        programId: 'prog-1',
        amount: 25,
        currency: 'INR',
        reference: 'txn-789',
      };

      const result = await controller.awardRewards(body as any);

      expect(result).toEqual(mockAwardResult);
      expect(pointsService.awardRewards).toHaveBeenCalled();
    });
  });

  describe('reverseRewards', () => {
    it('should reverse rewards and return details', async () => {
      const body = {
        referenceId: 'ref-1',
        reason: 'Customer returned item',
      };

      const result = await controller.reverseRewards(body as any);

      expect(result).toEqual(mockReverseResult);
      expect(pointsService.reverseRewards).toHaveBeenCalledWith('ref-1', '', '');
    });

    it('should pass body fields to service', async () => {
      await controller.reverseRewards({
        referenceId: 'ref-2',
        programId: 'prog-1',
        customerId: 'cust-1',
      } as any);

      expect(pointsService.reverseRewards).toHaveBeenCalledWith('ref-2', 'prog-1', 'cust-1');
    });
  });

  describe('expireRewards', () => {
    it('should expire rewards and return confirmation', async () => {
      const body = {
        programId: 'prog-1',
        customerId: 'cust-1',
        amount: 50,
        cutoffDate: '2024-12-31',
      };

      const result = await controller.expireRewards(body as any);

      expect(result).toEqual(mockExpireResult);
      expect(pointsService.expireRewards).toHaveBeenCalledWith('prog-1', 'cust-1', 50);
    });

    it('should default to empty strings and 0 when fields missing', async () => {
      await controller.expireRewards({} as any);

      expect(pointsService.expireRewards).toHaveBeenCalledWith('', '', 0);
    });
  });
});
