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
import { CouponValidatorService } from './coupon-validator.service';
import { CouponCodeService } from './coupon-code.service';
import { SephoraResponseMapper } from './sephora-response.mapper';
import { RuleEngineModule } from 'src/modules/rule-engine/rule-engine.module';
import { EligibilityEngineModule } from 'src/modules/eligibility-engine/eligibility-engine.module';
import { BudgetEngineModule } from 'src/modules/budget-engine/budget-engine.module';
import { EventEngineModule } from 'src/modules/event-engine/event-engine.module';
import { AuditEngineModule } from 'src/modules/audit-engine/audit-engine.module';
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
    CouponValidatorService,
    CouponCodeService,
    SephoraResponseMapper,
  ],
  exports: [
    PromoService,
    PromotionRepositoryService,
    ConflictResolverService,
    DiscountEngineService,
    CouponManagerService,
    ClaimManagerService,
    PromoEventPublisherService,
    CouponValidatorService,
    CouponCodeService,
    SephoraResponseMapper,
  ],
})
export class PromoModule {}
