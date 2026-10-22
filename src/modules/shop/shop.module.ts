import { Module } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prismaService';
import { ImgBBHttpModule } from 'src/modules/http/parties/imgbb.http.module';
import { AuthModule } from '../auth/auth.module';
import { MailAndSmsModule } from '../mail-and-sms/mail-and-sms.module';
import { OrganizationModule } from '../organization/organization.module';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [ImgBBHttpModule, MailAndSmsModule, AuthModule, OrganizationModule],
  controllers: [ShopController],
  providers: [ShopService, PrismaService],
  exports: [],
})
export class ShopModule {}
