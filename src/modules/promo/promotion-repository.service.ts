import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prismaService';
import { RuleDefinition, RuleConditionGroup } from 'src/modules/rule-engine/rule-engine.types';

export interface PromotionRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  programType: 'PROMO' | 'LOYALTY';
  rewardType: string;
  status: string;
  rewardCurrency: string;
  budgetEnabled: boolean;
  priority: number;
  business: string | null;
  category: string | null;
  startDate: Date;
  endDate: Date;
  timezone: string;
  blackoutDates: string[] | null;
  workingDays: number[] | null;
  dailyTimeSlots: { start: string; end: string }[] | null;
  version: number;
  rules: RuleDefinition[];
}

export interface PromotionQuery {
  organizationId?: string;
  programType?: 'PROMO' | 'LOYALTY';
  status?: string;
  business?: string;
  category?: string;
  rewardType?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Promotion Repository — loads active promotions from the database.
 * Translates Prisma RewardProgram + RewardProgramRule records into
 * the domain-friendly PromotionRecord shape consumed by the engines.
 */
@Injectable()
export class PromotionRepositoryService {
  private readonly logger = new Logger(PromotionRepositoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Load a single promotion by ID, including its rules.
   */
  async findById(id: string): Promise<PromotionRecord | null> {
    const program = await this.prisma.rewardProgram.findUnique({
      where: { id },
      include: { rules: true },
    });

    if (!program) return null;
    return this.toPromotionRecord(program);
  }

  /**
   * Load all active promotions matching the given query.
   * "Active" means status=ACTIVE, not archived, and within date range.
   */
  async findActive(query: PromotionQuery = {}): Promise<PromotionRecord[]> {
    const now = new Date();

    const where: any = {
      isArchived: false,
      status: 'ACTIVE',
      startDate: { lte: now },
      endDate: { gte: now },
    };

    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.programType) where.programType = query.programType;
    if (query.business) where.business = query.business;
    if (query.category) where.category = query.category;
    if (query.rewardType) where.rewardType = query.rewardType;

    const programs = await this.prisma.rewardProgram.findMany({
      where,
      include: { rules: true },
      orderBy: { priority: 'desc' },
      take: query.limit ?? 100,
      skip: query.offset ?? 0,
    });

    return programs.map((p) => this.toPromotionRecord(p));
  }

  /**
   * Load all promotions (including inactive) for admin views.
   */
  async findAll(query: PromotionQuery = {}): Promise<PromotionRecord[]> {
    const where: any = {};

    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.programType) where.programType = query.programType;
    if (query.status) where.status = query.status;
    if (query.business) where.business = query.business;
    if (query.category) where.category = query.category;

    const programs = await this.prisma.rewardProgram.findMany({
      where,
      include: { rules: true },
      orderBy: { priority: 'desc' },
      take: query.limit ?? 100,
      skip: query.offset ?? 0,
    });

    return programs.map((p) => this.toPromotionRecord(p));
  }

  /**
   * Map a Prisma RewardProgram (with rules) to a PromotionRecord.
   */
  private toPromotionRecord(program: any): PromotionRecord {
    const rules: RuleDefinition[] = (program.rules ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      conditions: (r.conditions as RuleConditionGroup) ?? {
        operator: 'AND',
        conditions: [],
      },
      rewardType: r.rewardType,
      rewardMode: r.rewardMode,
      value: Number(r.value),
      ratioBase: r.ratioBase ? Number(r.ratioBase) : undefined,
      threshold: r.threshold ? Number(r.threshold) : undefined,
      meta: (r.meta as Record<string, any>) ?? undefined,
      priority: program.priority,
    }));

    return {
      id: program.id,
      organizationId: program.organizationId,
      name: program.name,
      description: program.description,
      programType: program.programType as 'PROMO' | 'LOYALTY',
      rewardType: program.rewardType,
      status: program.status,
      rewardCurrency: program.rewardCurrency,
      budgetEnabled: program.budgetEnabled,
      priority: program.priority,
      business: program.business,
      category: program.category,
      startDate: program.startDate,
      endDate: program.endDate,
      timezone: program.timezone ?? 'UTC',
      blackoutDates: program.blackoutDates as string[] | null,
      workingDays: program.workingDays as number[] | null,
      dailyTimeSlots: program.dailyTimeSlots as { start: string; end: string }[] | null,
      version: program.version,
      rules,
    };
  }
}