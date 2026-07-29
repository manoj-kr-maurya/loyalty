import { Module } from '@nestjs/common';
import { BudgetEngineService } from './budget-engine.service';
import { PrismaService } from '../../../common/services/prismaService';

@Module({
  providers: [BudgetEngineService, PrismaService],
  exports: [BudgetEngineService],
})
export class BudgetEngineModule {}
