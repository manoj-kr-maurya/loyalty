import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import { AuthModule } from '../auth/auth.module';
import { CustomerWalletsModule } from '../customer-wallets/customer-wallets.module';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { RuleEngineModule } from 'src/modules/rule-engine/rule-engine.module';
import { EligibilityEngineModule } from 'src/modules/eligibility-engine/eligibility-engine.module';
import { BudgetEngineModule } from 'src/modules/budget-engine/budget-engine.module';
import { EventEngineModule } from 'src/modules/event-engine/event-engine.module';
import { AuditEngineModule } from 'src/modules/audit-engine/audit-engine.module';

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
