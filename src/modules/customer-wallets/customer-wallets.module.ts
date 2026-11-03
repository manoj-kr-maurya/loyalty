import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { CustomerModule } from '../customer/customer.module';
import { PrismaService } from 'src/common/services/prismaService';
import { CustomerWalletService } from './customer-wallets.service';
import { CustomerWalletsPrismaHelperService } from './customer-wallets-prisma-helper.service';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { CustomerWalletJobProducer } from './jobs/producer';
import { CustomerWalletJobConsumer } from './jobs/consumer';
import { JobSchedulerModule } from 'src/modules/jobs/job-scheduler.module';
import { CustomerWalletController } from './customer-wallets.controller';

@Module({
  imports: [AuthModule, CustomerModule, JobSchedulerModule],
  controllers: [CustomerWalletController],
  providers: [
    CustomerWalletService,
    ConfigService,
    PrismaService,
    CommonUtilsService,
    CustomerWalletsPrismaHelperService,
    CustomerWalletJobProducer,
    CustomerWalletJobConsumer,
  ],
  exports: [CustomerWalletsPrismaHelperService, CustomerWalletService],
})
export class CustomerWalletsModule {}
