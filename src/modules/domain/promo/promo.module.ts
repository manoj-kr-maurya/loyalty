import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import { AuthModule } from '../auth/auth.module';
import { PromoController } from './promo.controller';
import { PromoService } from './promo.service';
import { PromotionRepositoryService } from './promotion-repository.service';
import { ConflictResolverService } from './conflict-resolver.service';
import { DiscountEngineService } from './discount-engine.service';
import { CouponManagerService } from './coupon-manager.service';
import { ClaimManagerService } from './claim-manager.service';
import { PromoEventPublisherService } from './promo-event-publisher.service';
import { RuleEngineModule } from 'src/modules/core/rule-engine/rule-engine.module';
import { EligibilityEngineModule } from 'src/modules/core/eligibility-engine/eligibility-engine.module';
import { BudgetEngineModule } from 'src/modules/core/budget-engine/budget-engine.module';
import { EventEngineModule } from 'src/modules/core/event-engine/event-engine.module';
import { AuditEngineModule } from 'src/modules/core/audit-engine/audit-engine.module';
import { PrismaService } from 'src/common/services/prismaService';

@Module({
  imports: [
    AuthModule,
    CampaignModule,
    RuleEngineModule,
    EligibilityEngineModule,
    BudgetEngineModule,
    EventEngineModule,
    AuditEngineModule,
  ],
  controllers: [PromoController],
  providers: [
    PrismaService,
    PromoService,
    PromotionRepositoryService,
    ConflictResolverService,
    DiscountEngineService,
    CouponManagerService,
    ClaimManagerService,
    PromoEventPublisherService,
  ],
  exports: [
    PromoService,
    PromotionRepositoryService,
    ConflictResolverService,
    DiscountEngineService,
    CouponManagerService,
    ClaimManagerService,
    PromoEventPublisherService,
  ],
})
export class PromoModule {}
