import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

// ─── Input / Output Types ───────────────────────────────

export interface CreatePLBProgramInput {
  organizationId: string;
  name: string;
  description?: string;
  metricType: 'REVENUE' | 'TRANSACTIONS' | 'CUSTOMERS' | 'CUSTOM';
  metricKey?: string;
  cycleType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'CUSTOM';
  cycleStart: Date;
  cycleEnd: Date;
  tiers: PLBTierInput[];
  isActive?: boolean;
}

export interface PLBTierInput {
  level: number;
  name: string;
  minThreshold: number;
  maxThreshold?: number;
  bonusType: 'PERCENTAGE' | 'ABSOLUTE' | 'MULTIPLIER';
  bonusValue: number;
  bonusCap?: number;
}

export interface PLBMetricInput {
  organizationId: string;
  programId: string;
  customerId: string; // maps to entityId in DB
  metricValue: number;
  periodStart: Date;
  periodEnd: Date;
  metadata?: Record<string, any>;
}

export interface PLBBonusOutput {
  customerId: string;
  organizationId: string;
  programId: string;
  programName: string;
  cycleStart: Date;
  cycleEnd: Date;
  metricValue: number;
  tierAchieved: string | null;
  bonusType: string;
  bonusValue: number;
  bonusAmount: number;
  bonusCap: number | null;
  finalBonus: number;
}

export interface PLBStatementInput {
  customerId: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class PLBEngineService {
  private readonly logger = new Logger(PLBEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Program Management ───────────────────────────────

  /**
   * Create a PLB program with tiered bonus structure.
   */
  async createProgram(input: CreatePLBProgramInput): Promise<{
    id: string;
    name: string;
    cycleType: string;
    tiers: number;
  }> {
    const { organizationId, name, description, metricType, metricKey, cycleType, cycleStart, cycleEnd, tiers, isActive } = input;

    // Validate tiers
    const sorted = [...tiers].sort((a, b) => a.level - b.level);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].level !== i + 1) {
        throw new CommonException(
          `Tier levels must be sequential starting from 1`,
          StatusCodes.BAD_REQUEST,
        );
      }
      if (i > 0 && sorted[i].minThreshold <= sorted[i - 1].minThreshold) {
        throw new CommonException(
          `Tier ${sorted[i].level} threshold must be greater than tier ${sorted[i - 1].level}`,
          StatusCodes.BAD_REQUEST,
        );
      }
    }

    const program = await this.prisma.pLBProgram.create({
      data: {
        organizationId,
        name,
        description,
        cycleType,
        cycleStart,
        cycleEnd,
        metricDefinitions: { metricType, metricKey },
        slabDefinitions: tiers.map((t) => ({
          min: t.minThreshold,
          max: t.maxThreshold,
          incentiveType: t.bonusType,
          incentiveValue: t.bonusValue,
          bonusCap: t.bonusCap,
        })),
        status: isActive ?? true ? 'ACTIVE' : 'DRAFT',
      },
    });

    this.logger.log(`PLB program created: ${name} (${cycleType}) with ${tiers.length} tiers`);
    return { id: program.id, name: program.name, cycleType: program.cycleType, tiers: tiers.length };
  }

  /**
   * Get all PLB programs for an organization.
   */
  async getPrograms(organizationId: string): Promise<Array<{
    id: string;
    name: string;
    cycleType: string;
    isActive: boolean;
    tiers: number;
  }>> {
    const programs = await this.prisma.pLBProgram.findMany({
      where: { organizationId },
    });

    return programs.map((p) => ({
      id: p.id,
      name: p.name,
      cycleType: p.cycleType,
      isActive: p.status === 'ACTIVE',
      tiers: (p.slabDefinitions as any[]).length,
    }));
  }

  // ─── Metric Tracking ──────────────────────────────────

  /**
   * Record a metric value for an entity in a PLB program.
   */
  async recordMetric(input: PLBMetricInput): Promise<{
    id: string;
    entityId: string;
    programId: string;
    metricValue: number;
  }> {
    const { organizationId, programId, customerId, metricValue, periodStart, periodEnd, metadata } = input;

    // Verify program exists
    const program = await this.prisma.pLBProgram.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new CommonException('PLB program not found', StatusCodes.NOT_FOUND);
    }

    const metricDefs = program.metricDefinitions as Record<string, any>;
    const metricName = metricDefs?.metricKey || 'default';

    const metric = await this.prisma.pLBMetric.create({
      data: {
        programId,
        entityId: customerId,
        entityType: 'CUSTOMER',
        metricName,
        metricValue,
        targetValue: 0,
        achievementPct: 0,
        periodStart,
        periodEnd,
      },
    });

    this.logger.log(`Metric recorded: entity=${customerId} program=${programId} value=${metricValue}`);
    return { id: metric.id, entityId: customerId, programId, metricValue: Number(metric.metricValue) };
  }

  // ─── Bonus Calculation ────────────────────────────────

  /**
   * Calculate PLB bonus for a customer based on their metrics.
   */
  async calculateBonus(input: {
    organizationId: string;
    programId: string;
    customerId: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<PLBBonusOutput> {
    const { organizationId, programId, customerId, periodStart, periodEnd } = input;

    // Get program
    const program = await this.prisma.pLBProgram.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new CommonException('PLB program not found', StatusCodes.NOT_FOUND);
    }

    const slabDefs = (program.slabDefinitions as any[]) || [];

    // Aggregate metrics for the period
    const metrics = await this.prisma.pLBMetric.findMany({
      where: {
        programId,
        entityId: customerId,
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
    });

    const totalMetricValue = metrics.reduce(
      (sum, m) => sum + Number(m.metricValue),
      0,
    );

    // Find the highest slab achieved (sorted by min ascending)
    const sortedSlabs = [...slabDefs].sort((a, b) => a.min - b.min);
    let achievedSlab: typeof sortedSlabs[0] | null = null;
    for (const slab of sortedSlabs) {
      if (totalMetricValue >= slab.min) {
        if (!slab.max || totalMetricValue <= slab.max) {
          achievedSlab = slab;
        }
      }
    }

    if (!achievedSlab) {
      return {
        customerId,
        organizationId,
        programId,
        programName: program.name,
        cycleStart: periodStart,
        cycleEnd: periodEnd,
        metricValue: totalMetricValue,
        tierAchieved: null,
        bonusType: 'NONE',
        bonusValue: 0,
        bonusAmount: 0,
        bonusCap: null,
        finalBonus: 0,
      };
    }

    // Calculate bonus
    let bonusAmount = 0;
    switch (achievedSlab.incentiveType) {
      case 'PERCENTAGE':
        bonusAmount = totalMetricValue * (Number(achievedSlab.incentiveValue) / 100);
        break;
      case 'ABSOLUTE':
        bonusAmount = Number(achievedSlab.incentiveValue);
        break;
      case 'MULTIPLIER':
        bonusAmount = totalMetricValue * Number(achievedSlab.incentiveValue);
        break;
    }

    // Apply cap
    const bonusCap = achievedSlab.bonusCap ? Number(achievedSlab.bonusCap) : null;
    const finalBonus = bonusCap ? Math.min(bonusAmount, bonusCap) : bonusAmount;

    // Persist bonus record
    await this.prisma.pLBBonus.create({
      data: {
        programId,
        entityId: customerId,
        cycleStart: periodStart,
        cycleEnd: periodEnd,
        slabName: `Slab ${sortedSlabs.indexOf(achievedSlab) + 1}`,
        incentiveType: achievedSlab.incentiveType,
        incentiveValue: Number(achievedSlab.incentiveValue),
        currency: 'INR',
        status: 'PENDING',
      },
    });

    this.logger.log(
      `Bonus calculated: customer=${customerId} program=${program.name} slab=${sortedSlabs.indexOf(achievedSlab) + 1} bonus=${finalBonus}`,
    );

    return {
      customerId,
      organizationId,
      programId,
      programName: program.name,
      cycleStart: periodStart,
      cycleEnd: periodEnd,
      metricValue: totalMetricValue,
      tierAchieved: `Slab ${sortedSlabs.indexOf(achievedSlab) + 1}`,
      bonusType: achievedSlab.incentiveType,
      bonusValue: Number(achievedSlab.incentiveValue),
      bonusAmount,
      bonusCap,
      finalBonus,
    };
  }

  /**
   * Evaluate all active programs for a customer in a cycle.
   */
  async evaluateCycle(input: {
    organizationId: string;
    customerId: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<{
    customerId: string;
    organizationId: string;
    totalBonus: number;
    programs: PLBBonusOutput[];
  }> {
    const { organizationId, customerId, periodStart, periodEnd } = input;

    const programs = await this.prisma.pLBProgram.findMany({
      where: { organizationId, status: 'ACTIVE' },
    });

    const bonuses: PLBBonusOutput[] = [];
    let totalBonus = 0;

    for (const program of programs) {
      const bonus = await this.calculateBonus({
        organizationId,
        programId: program.id,
        customerId,
        periodStart,
        periodEnd,
      });
      bonuses.push(bonus);
      totalBonus += bonus.finalBonus;
    }

    return { customerId, organizationId, totalBonus, programs: bonuses };
  }

  // ─── Statement ────────────────────────────────────────

  /**
   * Generate a PLB statement for a customer.
   */
  async generateStatement(input: PLBStatementInput): Promise<{
    customerId: string;
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    totalBonus: number;
    programs: Array<{
      programName: string;
      metricValue: number;
      tierAchieved: string | null;
      bonusAmount: number;
    }>;
  }> {
    const { customerId, organizationId, periodStart, periodEnd } = input;

    const bonuses = await this.prisma.pLBBonus.findMany({
      where: {
        entityId: customerId,
        cycleStart: { gte: periodStart },
        cycleEnd: { lte: periodEnd },
      },
    });

    const totalBonus = bonuses.reduce((sum, b) => sum + Number(b.incentiveValue), 0);

    // Get program names
    const programIds = [...new Set(bonuses.map((b) => b.programId))];
    const programs = await this.prisma.pLBProgram.findMany({
      where: { id: { in: programIds } },
      select: { id: true, name: true },
    });
    const programMap = new Map(programs.map((p) => [p.id, p.name]));

    return {
      customerId,
      organizationId,
      periodStart,
      periodEnd,
      totalBonus,
      programs: bonuses.map((b) => ({
        programName: programMap.get(b.programId) || 'Unknown',
        metricValue: 0, // Not stored on PLBBonus
        tierAchieved: b.slabName || null,
        bonusAmount: Number(b.incentiveValue),
      })),
    };
  }
}