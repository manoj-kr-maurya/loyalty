import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonDBService } from 'src/common/services/common-db.service';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { JobSchedulerModule } from 'src/modules/jobs/job-scheduler.module';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { MailAndSmsModule } from '../mail-and-sms/mail-and-sms.module';
import { OrganizationOrderModule } from '../organization-order/organization-order.module';
import { OrganizationPrismaHelperService } from './organization-prisma-helper.service';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationJobConsumer } from './jobs/consumer';
import { ImgBBHttpModule } from 'src/modules/http/parties/imgbb.http.module';
import { ImgBBService } from 'src/modules/imgbb/imgbb.service';
import { CacheService } from 'src/common/services/cache';
import { RedisCacheStrategy } from 'src/common/services/cache/strategies/redis-cache.strategy';

@Module({
  imports: [
    ImgBBHttpModule,
    MailAndSmsModule,
    AuthModule,
    OrganizationOrderModule,
    JobSchedulerModule,
  ],
  controllers: [OrganizationController],
  providers: [
    CacheService,
    RedisCacheStrategy,
    OrganizationService,
    AuthService,
    PrismaService,
    CommonUtilsService,
    ConfigService,
    CommonDBService,
    OrganizationJobConsumer,
    OrganizationPrismaHelperService,
    ImgBBService,
  ],
  exports: [
    OrganizationService,
    OrganizationPrismaHelperService,
    OrganizationModule,
    OrganizationOrderModule,
  ],
})
export class OrganizationModule {}
