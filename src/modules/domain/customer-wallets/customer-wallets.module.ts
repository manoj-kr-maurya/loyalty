import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from 'src/common/services/prismaService';
import { CustomerWalletService } from './customer-wallets.service';
import { CustomerWalletsPrismaHelperService } from './customer-wallets-prisma-helper.service';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { CustomerWalletJobProducer } from './jobs/producer';
import { CustomerWalletJobConsumer } from './jobs/consumer';
import { AgendaModule } from 'src/modules/agenda/agenda.module';
import { CustomerWalletController } from './customer-wallets.controller';

@Module({
  imports: [AuthModule, AgendaModule],
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
