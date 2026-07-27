import { Module } from '@nestjs/common';
import { PGListenerService } from './pg/pg-listener.service';
import { CurrencyService } from '../domain/currency/currency.service';
import { OrganizationService } from '../domain/organization/organization.service';
import { CustomerService } from '../domain/customer/customer.service';
import { PrismaService } from 'src/common/services/prismaService';
import { CurrencyPrismaHelperService } from '../domain/currency/currency-prisma-helper.service';
import { CurrencyJobProducer } from '../domain/currency/jobs/producer';
import { OrganizationOrderService } from '../domain/organization-order/organization-order.service';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { CampaignModule } from '../domain/campaign/campaign.module';
import { CurrencyModule } from '../domain/currency/currency.module';
import { OrganizationModule } from '../domain/organization/organization.module';
import { AuthModule } from '../domain/auth/auth.module';
import { CommonDBService } from 'src/common/services/common-db.service';
import { ImgBBService } from '../core/imgbb/imgbb.service';
import { ImgBBHttpModule } from '../http/parties/imgbb.http.module';
import { CustomerModule } from '../domain/customer/customer.module';
import { CacheService } from 'src/common/services/cache';
import { RedisCacheStrategy } from 'src/common/services/cache/strategies/redis-cache.strategy';
import { AgendaModule } from '../agenda/agenda.module';
import { CampaignJobProducer } from '../domain/campaign/jobs/producer';

@Module({
  imports: [
    CampaignModule,
    CustomerModule,
    CurrencyModule,
    OrganizationModule,
    AuthModule,
    ImgBBHttpModule,
    AgendaModule,
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
