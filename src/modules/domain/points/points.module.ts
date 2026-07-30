import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import { AuthModule } from '../auth/auth.module';
import { CustomerWalletsModule } from '../customer-wallets/customer-wallets.module';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { RuleEngineModule } from 'src/modules/core/rule-engine/rule-engine.module';
import { EligibilityEngineModule } from 'src/modules/core/eligibility-engine/eligibility-engine.module';
import { BudgetEngineModule } from 'src/modules/core/budget-engine/budget-engine.module';
import { EventEngineModule } from 'src/modules/core/event-engine/event-engine.module';
import { AuditEngineModule } from 'src/modules/core/audit-engine/audit-engine.module';

@Module({
  imports: [
    AuthModule,
    CustomerWalletsModule,
    CampaignModule,
    RuleEngineModule,
    EligibilityEngineModule,
    BudgetEngineModule,
    EventEngineModule,
    AuditEngineModule,
  ],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
