import { Module } from '@nestjs/common';
import { EligibilityEngineService } from './eligibility-engine.service';
import { RuleEngineModule } from '../rule-engine/rule-engine.module';

@Module({
  imports: [RuleEngineModule],
  providers: [EligibilityEngineService],
  exports: [EligibilityEngineService],
})
export class EligibilityEngineModule {}
