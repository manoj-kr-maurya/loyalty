import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { MailAndSmsModule } from '../mail-and-sms/mail-and-sms.module';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';

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
  providers: [AuthService, ConfigService, CommonUtilsService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
