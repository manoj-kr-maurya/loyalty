import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { AuthModule } from '../auth/auth.module';
import { MailAndSmsModule } from '../mail-and-sms/mail-and-sms.module';
import { OrganizationModule } from '../organization/organization.module';
import { CustomerPrismaHelperService } from './customer-prisma-helper.service';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { CustomCacheModule } from 'src/common/services/cache/cache.module';
import { ImgBBHttpModule } from 'src/modules/http/parties/imgbb.http.module';
import { ImgBBService } from 'src/modules/core/imgbb/imgbb.service';

@Module({
  imports: [
    ImgBBHttpModule,
    MailAndSmsModule,
    AuthModule,
    OrganizationModule,
    CustomCacheModule,
  ],
  controllers: [CustomerController],
  providers: [
    PrismaService,
    CustomerService,
    ConfigService,
    CommonUtilsService,
    Logger,
    CustomerPrismaHelperService,
    ImgBBService,
  ],
  exports: [CustomerPrismaHelperService, CustomerService],
})
export class CustomerModule {}
