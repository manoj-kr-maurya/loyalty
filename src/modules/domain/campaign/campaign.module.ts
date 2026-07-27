import { Module } from '@nestjs/common';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { AuthModule } from '../auth/auth.module';
import { ConfigService } from '@nestjs/config';
import { OrganizationModule } from '../organization/organization.module';
import { CurrencyModule } from '../currency/currency.module';
import { CampaignPrismaHelperService } from './campaign-prisma-helper.service';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { CustomerService } from '../customer/customer.service';
import { CustomerPrismaHelperService } from '../customer/customer-prisma-helper.service';
import { CampaignJobProducer } from './jobs/producer';
import { AgendaService } from 'src/modules/agenda/agenda.service';
import { CampaignJobConsumer } from './jobs/consumer';
import { CacheService } from 'src/common/services/cache';
import { RedisCacheStrategy } from 'src/common/services/cache/strategies/redis-cache.strategy';
import { ImgBBHttpModule } from 'src/modules/http/parties/imgbb.http.module';
import { ImgBBService } from 'src/modules/core/imgbb/imgbb.service';

@Module({
  imports: [ImgBBHttpModule, AuthModule, OrganizationModule, CurrencyModule],
  controllers: [CampaignController],
  providers: [
    ImgBBService,
    CacheService,
    RedisCacheStrategy,
    AgendaService,
    CustomerPrismaHelperService,
    CustomerService,
    CampaignJobConsumer,
    CampaignService,
    PrismaService,
    CommonUtilsService,
    ConfigService,
    CampaignPrismaHelperService,
    CampaignJobProducer,
  ],
  exports: [CampaignPrismaHelperService, CampaignService],
})
export class CampaignModule {}
