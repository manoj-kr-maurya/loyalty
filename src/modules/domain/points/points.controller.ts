import { Body, Controller, Get, Post, UseGuards, UsePipes } from '@nestjs/common';
import { ApiTags, ApiSecurity } from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { JoiValidationPipe } from 'src/common/pipes/joi-validation.pipe';
import { PointsService } from './points.service';
import { ProgramFormDto, ProgramFormSchema } from './DTO/program.dto';
import {
  RewardCalculationSchema,
  BlockRewardSchema,
  AwardRewardSchema,
  ReverseRewardSchema,
  ExpireRewardSchema,
} from './DTO/reward.dto';
import { FilterContext, RuleDefinition } from 'src/modules/core/rule-engine/rule-engine.types';
import { EligibilityCriteria } from 'src/modules/core/eligibility-engine/eligibility-engine.service';
import { BudgetReservation } from 'src/modules/core/budget-engine/budget-engine.service';

@ApiTags('Loyalty Programs')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('loyalty-programs')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Post('/program/create')
  @UsePipes(new JoiValidationPipe(ProgramFormSchema))
  async createProgram(@Body() form: ProgramFormDto) {
    return this.pointsService.createProgram(form);
  }

  @Post('/eligible')
  @UsePipes(new JoiValidationPipe(RewardCalculationSchema))
  async findEligiblePrograms(@Body() body: any) {
    const context: FilterContext = body;
    const criteria: EligibilityCriteria = body;
    return this.pointsService.findEligiblePrograms(context, criteria);
  }

  @Post('/calculate')
  @UsePipes(new JoiValidationPipe(RewardCalculationSchema))
  async calculateRewards(@Body() body: any) {
    const context: FilterContext = body;
    const criteria: EligibilityCriteria = body;
    const rules = body.rules ?? [];
    return this.pointsService.calculateRewards(context, criteria, rules);
  }

  @Post('/block')
  @UsePipes(new JoiValidationPipe(BlockRewardSchema))
  async blockRewards(@Body() body: any) {
    const context: FilterContext = body;
    const criteria: EligibilityCriteria = body;
    const rules = body.rules ?? [];
    const budgetReservation: BudgetReservation = {
      programId: body.programId ?? '',
      amount: body.amount ?? 0,
      currency: body.currency,
      reference: body.reference,
    };
    return this.pointsService.blockRewards(context, criteria, rules, budgetReservation);
  }

  @Post('/award')
  @UsePipes(new JoiValidationPipe(AwardRewardSchema))
  async awardRewards(@Body() body: any) {
    const context: FilterContext = body;
    const rules = body.rules ?? [];
    const budgetReservation: BudgetReservation = {
      programId: body.programId ?? '',
      amount: body.amount ?? 0,
      currency: body.currency,
      reference: body.reference,
    };
    return this.pointsService.awardRewards(context, rules, budgetReservation);
  }

  @Post('/reverse')
  @UsePipes(new JoiValidationPipe(ReverseRewardSchema))
  async reverseRewards(@Body() body: any) {
    return this.pointsService.reverseRewards(
      body.referenceId ?? '',
      body.programId ?? '',
      body.customerId ?? '',
    );
  }

  @Post('/expire')
  @UsePipes(new JoiValidationPipe(ExpireRewardSchema))
  async expireRewards(@Body() body: any) {
    return this.pointsService.expireRewards(
      body.programId ?? '',
      body.customerId ?? '',
      body.amount ?? 0,
    );
  }
}
