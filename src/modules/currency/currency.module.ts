import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonDBService } from 'src/common/services/common-db.service';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { JobSchedulerModule } from 'src/modules/jobs/job-scheduler.module';
import { AuthModule } from '../auth/auth.module';
import { MailAndSmsModule } from '../mail-and-sms/mail-and-sms.module';
import { OrganizationModule } from '../organization/organization.module';
import { OrganizationOrderModule } from '../organization-order/organization-order.module';
import { CurrencyPrismaHelperService } from './currency-prisma-helper.service';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { CurrencyJobProducer } from './jobs/producer';
import { CustomerService } from '../customer/customer.service';
import { CustomerPrismaHelperService } from '../customer/customer-prisma-helper.service';
import { CacheService } from 'src/common/services/cache';
import { RedisCacheStrategy } from 'src/common/services/cache/strategies/redis-cache.strategy';
import { ImgBBHttpModule } from 'src/modules/http/parties/imgbb.http.module';
import { ImgBBService } from 'src/modules/imgbb/imgbb.service';

@Module({
  imports: [
    ImgBBHttpModule,
    MailAndSmsModule,
    OrganizationOrderModule,
    AuthModule,
    OrganizationModule,
    JobSchedulerModule,
  ],
  providers: [
    ImgBBService,
    CacheService,
    RedisCacheStrategy,
    CurrencyService,
    CurrencyPrismaHelperService,
    PrismaService,
    CommonUtilsService,
    CommonDBService,
    ConfigService,
    CurrencyJobProducer,
    CustomerService,
    CustomerPrismaHelperService,
  ],
  controllers: [CurrencyController],
  exports: [CurrencyService, CurrencyPrismaHelperService],
})
export class CurrencyModule {}
