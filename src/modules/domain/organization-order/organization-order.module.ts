import { Module } from '@nestjs/common';
import { OrganizationOrderService } from './organization-order.service';
import { OrganizationOrderController } from './organization-order.controller';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { OrganizationOrderPrismaHelperService } from './organization-order-prisma-helper.service';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';

@Module({
  imports: [AuthModule],
  providers: [
    OrganizationOrderService,
    ConfigService,
    PrismaService,
    CommonUtilsService,
    OrganizationOrderPrismaHelperService,
  ],
  controllers: [OrganizationOrderController],
  exports: [OrganizationOrderService, OrganizationOrderPrismaHelperService],
})
export class OrganizationOrderModule {}
