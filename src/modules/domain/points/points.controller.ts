import { Body, Controller, Get, Post, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VerifyJWTAndFetchPayload } from 'src/interceptors/auth/verify-jwt-and-fetch-payload';
import { PointsService } from './points.service';
import { ProgramFormDto } from './DTO/program.dto';
import {
  RewardCalculationDto,
  BlockRewardDto,
  AwardRewardDto,
  ReverseRewardDto,
  ExpireRewardDto,
} from './DTO/reward.dto';
import { FilterContext, RuleDefinition } from 'src/modules/core/rule-engine/rule-engine.types';
import { EligibilityCriteria } from 'src/modules/core/eligibility-engine/eligibility-engine.service';
import { BudgetReservation } from 'src/modules/core/budget-engine/budget-engine.service';

@ApiTags('Loyalty Programs')
@Controller('loyalty-programs')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Post('/program/create')
  @UseInterceptors(VerifyJWTAndFetchPayload)
  async createProgram(@Body() form: ProgramFormDto) {
    return this.pointsService.createProgram(form);
  }

  @Post('/eligible')
  async findEligiblePrograms(@Body() body: RewardCalculationDto) {
    const context: FilterContext = body as any;
    const criteria: EligibilityCriteria = body as any;
    return this.pointsService.findEligiblePrograms(context, criteria);
  }

  @Post('/calculate')
  async calculateRewards(@Body() body: RewardCalculationDto) {
    const context: FilterContext = body as any;
    const criteria: EligibilityCriteria = body as any;
    const rules = (body as any).rules ?? [];
    return this.pointsService.calculateRewards(context, criteria, rules);
  }

  @Post('/block')
  async blockRewards(@Body() body: BlockRewardDto) {
    const context: FilterContext = body as any;
    const criteria: EligibilityCriteria = body as any;
    const rules = (body as any).rules ?? [];
    const budgetReservation: BudgetReservation = {
      programId: (body as any).programId ?? '',
      amount: (body as any).amount ?? 0,
      currency: (body as any).currency,
      reference: (body as any).reference,
    };
    return this.pointsService.blockRewards(context, criteria, rules, budgetReservation);
  }

  @Post('/award')
  async awardRewards(@Body() body: AwardRewardDto) {
    const context: FilterContext = body as any;
    const rules = (body as any).rules ?? [];
    const budgetReservation: BudgetReservation = {
      programId: (body as any).programId ?? '',
      amount: (body as any).amount ?? 0,
      currency: (body as any).currency,
      reference: (body as any).reference,
    };
    return this.pointsService.awardRewards(context, rules, budgetReservation);
  }

  @Post('/reverse')
  async reverseRewards(@Body() body: ReverseRewardDto) {
    return this.pointsService.reverseRewards(
      (body as any).referenceId ?? '',
      (body as any).programId ?? '',
      (body as any).customerId ?? '',
    );
  }

  @Post('/expire')
  async expireRewards(@Body() body: ExpireRewardDto) {
    return this.pointsService.expireRewards(
      (body as any).programId ?? '',
      (body as any).customerId ?? '',
      (body as any).amount ?? 0,
    );
  }
}
