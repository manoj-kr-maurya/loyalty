import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prismaService';

export interface BudgetReservation {
  programId: string;
  amount: number;
  currency?: string;
  reference?: string;
}

export interface BudgetResult {
  reserved: boolean;
  remainingBudget: number;
  totalBudget: number;
  usedBudget: number;
  reason?: string;
}

/**
 * Budget Engine — manages budget allocation, reservation, and tracking
 * for reward programs. Uses Prisma for persistence with atomic updates.
 */
@Injectable()
export class BudgetEngineService {
  private readonly logger = new Logger(BudgetEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reserve budget for a reward. Uses atomic Prisma operations
   * to prevent race conditions under high concurrency.
   */
  async reserveBudget(reservation: BudgetReservation): Promise<BudgetResult> {
    const { programId, amount } = reservation;

    try {
      // Atomic update: only reserve if enough budget remains
      const result = await this.prisma.$transaction(async (tx) => {
        const budget = await tx.budget.findUnique({
          where: { programId },
        });

        if (!budget || !budget.isActive) {
          return {
            reserved: false,
            remainingBudget: 0,
            totalBudget: 0,
            usedBudget: 0,
            reason: 'No active budget found for this program',
          };
        }

        const available =
          Number(budget.totalBudget) -
          Number(budget.usedBudget) -
          Number(budget.reservedBudget);

        if (available < amount) {
          return {
            reserved: false,
            remainingBudget: available,
            totalBudget: Number(budget.totalBudget),
            usedBudget: Number(budget.usedBudget),
            reason: `Insufficient budget: available=${available}, requested=${amount}`,
          };
        }

        const updated = await tx.budget.update({
          where: { programId },
          data: {
            reservedBudget: {
              increment: amount,
            },
          },
        });

        return {
          reserved: true,
          remainingBudget:
            Number(updated.totalBudget) -
            Number(updated.usedBudget) -
            Number(updated.reservedBudget),
          totalBudget: Number(updated.totalBudget),
          usedBudget: Number(updated.usedBudget),
        };
      });

      return result;
    } catch (error) {
      this.logger.error(`Budget reservation failed: ${error.message}`, error.stack);
      return {
        reserved: false,
        remainingBudget: 0,
        totalBudget: 0,
        usedBudget: 0,
        reason: `Reservation error: ${error.message}`,
      };
    }
  }

  /**
   * Confirm a reservation — moves from reserved to used.
   */
  async confirmReservation(programId: string, amount: number): Promise<void> {
    await this.prisma.budget.update({
      where: { programId },
      data: {
        reservedBudget: { decrement: amount },
        usedBudget: { increment: amount },
      },
    });
  }

  /**
   * Release a reservation — decrements reserved without incrementing used.
   */
  async releaseReservation(programId: string, amount: number): Promise<void> {
    await this.prisma.budget.update({
      where: { programId },
      data: {
        reservedBudget: { decrement: amount },
      },
    });
  }

  /**
   * Create or update a budget for a program.
   */
  async upsertBudget(
    programId: string,
    totalBudget: number,
    currency: string = 'INR',
  ): Promise<void> {
    await this.prisma.budget.upsert({
      where: { programId },
      create: {
        programId,
        totalBudget,
        currency,
        usedBudget: 0,
        reservedBudget: 0,
        isActive: true,
      },
      update: {
        totalBudget,
        currency,
      },
    });
  }

  /**
   * Get current budget status for a program.
   */
  async getBudgetStatus(programId: string) {
    const budget = await this.prisma.budget.findUnique({
      where: { programId },
    });
    if (!budget) return null;
    return {
      totalBudget: Number(budget.totalBudget),
      usedBudget: Number(budget.usedBudget),
      reservedBudget: Number(budget.reservedBudget),
      available:
        Number(budget.totalBudget) -
        Number(budget.usedBudget) -
        Number(budget.reservedBudget),
      isActive: budget.isActive,
      currency: budget.currency,
    };
  }
}
