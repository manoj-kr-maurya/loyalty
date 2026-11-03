import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { CampaignModule } from '../campaign/campaign.module';
import { CustomerModule } from '../customer/customer.module';
import { OrganizationModule } from '../organization/organization.module';
import { CustomerOrganizationOrderController } from './customer-organization-order.controller';
import { CustomerOrganizationOrderService } from './customer-organization-order.service';
import { CustomerOrganizationOrderPrismaHelperService } from './customer-organization-order-prisma-helper.service';
import { PrismaService } from 'src/common/services/prismaService';
import { CustomerWalletsModule } from '../customer-wallets/customer-wallets.module';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { CustomerOrganizationOrderJobProducer } from './jobs/producer';
import { JobSchedulerModule } from 'src/modules/jobs/job-scheduler.module';
@Module({
  imports: [
    AuthModule,
    OrganizationModule,
    CustomerModule,
    CampaignModule,
    CustomerWalletsModule,
    JobSchedulerModule,
  ],
  providers: [
    CustomerOrganizationOrderPrismaHelperService,
    CustomerOrganizationOrderService,
    ConfigService,
    PrismaService,
    CommonUtilsService,
    CustomerOrganizationOrderJobProducer,
  ],
  controllers: [CustomerOrganizationOrderController],
  exports: [
    CustomerOrganizationOrderService,
    CustomerOrganizationOrderPrismaHelperService,
  ],
})
export class CustomerOrganizationOrderModule {}
