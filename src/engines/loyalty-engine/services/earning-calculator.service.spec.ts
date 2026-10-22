import { CommonException } from 'src/common/exceptions/common.exception';
import {
  EarningCalculatorService,
  TierLike,
} from './earning-calculator.service';

function expectCommonError(fn: () => void, message: string) {
  let thrown: unknown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(CommonException);
  expect((thrown as CommonException).getResponse()).toMatchObject({
    error: expect.stringContaining(message),
  });
}

describe('EarningCalculatorService', () => {
  const calculator = new EarningCalculatorService();

  const tiers: TierLike[] = [
    { id: 't1', name: 'Silver', level: 1, minPoints: 0, multiplier: 1 },
    { id: 't2', name: 'Gold', level: 2, minPoints: 1000, multiplier: 1.5 },
    { id: 't3', name: 'Platinum', level: 3, minPoints: 5000, multiplier: 2 },
  ];

  it('applies the current tier multiplier', () => {
    const result = calculator.calculate({
      amount: 200,
      tiers,
      currentTier: tiers[0],
      currentPoints: 0,
      lifetimePoints: 0,
    });

    expect(result.pointsEarned).toBe(200);
    expect(result.tierMultiplier).toBe(1);
    expect(result.projectedTier.name).toBe('Silver');
    expect(result.tierUpgraded).toBe(false);
  });

  it('upgrades when lifetime points cross the next threshold', () => {
    const result = calculator.calculate({
      amount: 1000,
      tiers,
      currentTier: tiers[0],
      currentPoints: 0,
      lifetimePoints: 0,
    });

    expect(result.pointsEarned).toBe(1000);
    expect(result.projectedTier.name).toBe('Gold');
    expect(result.tierUpgraded).toBe(true);
  });

  it('can jump multiple tiers in one earn', () => {
    const result = calculator.calculate({
      amount: 6000,
      tiers,
      currentTier: tiers[0],
      currentPoints: 0,
      lifetimePoints: 0,
    });

    expect(result.projectedTier.name).toBe('Platinum');
    expect(result.tierUpgraded).toBe(true);
  });

  it('never downgrades a customer', () => {
    const result = calculator.calculate({
      amount: 10,
      tiers,
      currentTier: tiers[2],
      currentPoints: 0,
      lifetimePoints: 6000,
    });

    expect(result.projectedTier.name).toBe('Platinum');
    expect(result.tierUpgraded).toBe(false);
  });

  it('throws when no tiers are configured', () => {
    expectCommonError(
      () => calculator.calculate({ amount: 100, tiers: [] }),
      'No loyalty tiers configured',
    );
  });

  it('throws for a non-positive amount', () => {
    expectCommonError(
      () => calculator.calculate({ amount: 0, tiers }),
      'Amount must be greater than zero',
    );
  });
});
