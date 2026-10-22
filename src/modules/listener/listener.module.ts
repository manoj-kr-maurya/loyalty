import { Module } from '@nestjs/common';
import { PGListenerService } from './pg/pg-listener.service';
import { CurrencyService } from '../currency/currency.service';
import { OrganizationService } from '../organization/organization.service';
import { CustomerService } from '../customer/customer.service';
import { PrismaService } from 'src/common/services/prismaService';
import { CurrencyPrismaHelperService } from '../currency/currency-prisma-helper.service';
import { CurrencyJobProducer } from '../currency/jobs/producer';
import { OrganizationOrderService } from '../organization-order/organization-order.service';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { CampaignModule } from '../campaign/campaign.module';
import { CurrencyModule } from '../currency/currency.module';
import { OrganizationModule } from '../organization/organization.module';
import { AuthModule } from '../auth/auth.module';
import { CommonDBService } from 'src/common/services/common-db.service';
import { ImgBBService } from '../imgbb/imgbb.service';
import { ImgBBHttpModule } from '../http/parties/imgbb.http.module';
import { CustomerModule } from '../customer/customer.module';
import { CacheService } from 'src/common/services/cache';
import { RedisCacheStrategy } from 'src/common/services/cache/strategies/redis-cache.strategy';
import { JobSchedulerModule } from '../jobs/job-scheduler.module';
import { CampaignJobProducer } from '../campaign/jobs/producer';

@Module({
  imports: [
    CampaignModule,
    CustomerModule,
    CurrencyModule,
    OrganizationModule,
    AuthModule,
    ImgBBHttpModule,
    JobSchedulerModule,
  ],
  providers: [
    PGListenerService,
    CacheService,
    CampaignJobProducer,
    CurrencyPrismaHelperService,
    ImgBBService,
    CommonDBService,
    OrganizationOrderService,
    CommonUtilsService,
    CurrencyService,
    OrganizationService,
    CustomerService,
    PrismaService,
    CurrencyJobProducer,
    RedisCacheStrategy,
  ],
  exports: [PGListenerService],
})
export class ListenerModule {}
