import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { PLBEngineService } from './plb-engine.service';

@ApiTags('engines-plb')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('engines/plb')
export class PLBEngineController {
  constructor(private readonly plbEngine: PLBEngineService) {}

  // ─── Program CRUD ─────────────────────────────────────

  @Post('programs')
  @HttpCode(HttpStatus.CREATED)
  async createProgram(@Body() body: {
    organizationId: string;
    name: string;
    description?: string;
    metricType: 'REVENUE' | 'TRANSACTIONS' | 'CUSTOMERS' | 'CUSTOM';
    metricKey?: string;
    cycleType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'CUSTOM';
    cycleStart: string;
    cycleEnd: string;
    tiers: Array<{
      level: number;
      name: string;
      minThreshold: number;
      maxThreshold?: number;
      bonusType: 'PERCENTAGE' | 'ABSOLUTE' | 'MULTIPLIER';
      bonusValue: number;
      bonusCap?: number;
    }>;
    isActive?: boolean;
  }) {
    return this.plbEngine.createProgram({
      ...body,
      cycleStart: new Date(body.cycleStart),
      cycleEnd: new Date(body.cycleEnd),
    });
  }

  @Get('programs/:organizationId')
  async getPrograms(@Param('organizationId') organizationId: string) {
    return this.plbEngine.getPrograms(organizationId);
  }

  // ─── Metrics ──────────────────────────────────────────

  @Post('metrics')
  @HttpCode(HttpStatus.CREATED)
  async recordMetric(@Body() body: {
    organizationId: string;
    programId: string;
    customerId: string;
    metricValue: number;
    periodStart: string;
    periodEnd: string;
    metadata?: Record<string, any>;
  }) {
    return this.plbEngine.recordMetric({
      ...body,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    });
  }

  // ─── Bonus Calculation ────────────────────────────────

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  async calculateBonus(@Body() body: {
    organizationId: string;
    programId: string;
    customerId: string;
    periodStart: string;
    periodEnd: string;
  }) {
    return this.plbEngine.calculateBonus({
      ...body,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    });
  }

  @Post('evaluate-cycle')
  @HttpCode(HttpStatus.OK)
  async evaluateCycle(@Body() body: {
    organizationId: string;
    customerId: string;
    periodStart: string;
    periodEnd: string;
  }) {
    return this.plbEngine.evaluateCycle({
      ...body,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    });
  }

  // ─── Statement ────────────────────────────────────────

  @Post('statement')
  @HttpCode(HttpStatus.OK)
  async generateStatement(@Body() body: {
    customerId: string;
    organizationId: string;
    periodStart: string;
    periodEnd: string;
  }) {
    return this.plbEngine.generateStatement({
      ...body,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    });
  }
}