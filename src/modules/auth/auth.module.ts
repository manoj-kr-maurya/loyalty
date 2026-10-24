import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { ConfigService } from '@nestjs/config';
import { MailAndSmsModule } from '../mail-and-sms/mail-and-sms.module';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { PrismaService } from 'src/common/services/prismaService';
import { OrganizationApiKeyGuard } from './guards/organization-api-key.guard';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { ScopesGuard } from './guards/scopes.guard';
import { CustomerJwtGuard } from './guards/customer-jwt.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '14d' },
      }),
    }),
    MailAndSmsModule,
  ],
  controllers: [ApiKeyController],
  providers: [
    AuthService,
    ApiKeyService,
    PrismaService,
    ConfigService,
    CommonUtilsService,
    OrganizationApiKeyGuard,
    PlatformAdminGuard,
    ScopesGuard,
    CustomerJwtGuard,
  ],
  exports: [
    JwtModule,
    AuthService,
    ApiKeyService,
    OrganizationApiKeyGuard,
    PlatformAdminGuard,
    ScopesGuard,
    CustomerJwtGuard,
  ],
})
export class AuthModule {}
