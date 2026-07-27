import { MailerModule } from '@nestjs-modules/mailer';
import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { Environments, envEnums } from './config/enums';
import { envSchema } from './config/env-schema';
import { IncomingReqResLoggingInterceptor } from './interceptors/log/incoming-req-res-logger.interceptor';
import { CampaignModule } from './modules/domain/campaign/campaign.module';
import { CurrencyModule } from './modules/domain/currency/currency.module';
import { CustomerModule } from './modules/domain/customer/customer.module';
import { CustomerOrganizationOrderModule } from './modules/domain/customer-organization-order/customer-organization-order.module';
import { MailAndSmsModule } from './modules/domain/mail-and-sms/mail-and-sms.module';
import { OrganizationModule } from './modules/domain/organization/organization.module';
import { OrganizationOrderModule } from './modules/domain/organization-order/organization-order.module';
import { HealthModule } from './modules/health/health.module';
import { OutgoingHttpModule } from './modules/http/http.module';
import { redisStore } from 'cache-manager-redis-yet';
import { CustomerWalletsModule } from './modules/domain/customer-wallets/customer-wallets.module';
import { AdminModule } from './modules/domain/admin/admin.module';
import { PrometheusMiddleware } from './middlewares/prometheus.middleware';
import { ListenerModule } from './modules/listener/listener.module';
import { ShopModule } from './modules/domain/shop/shop.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
      validationSchema: envSchema,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (configService: ConfigService) => {
        const store = await redisStore({
          socket: {
            host: configService.get<string>(envEnums.REDIS_HOST),
            port: configService.get<number>(envEnums.REDIS_PORT),
          },
          username: 'default',
          password:
            configService.get<string>(envEnums.ENVIRONMENT) !==
            Environments.local
              ? configService.get<string>(envEnums.REDIS_PASSWORD)
              : undefined,
          // If you need to set a global TTL, you can do it here:
          // ttl: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds
        });
        return {
          store: () => store,
        };
      },
      inject: [ConfigService],
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        transport: `smtps://${configService.get(
          envEnums.SENDER_MAIL,
        )}:${configService.get(envEnums.SENDER_PASSWORD)}@smtp.office365.com`,
        defaults: {
          from: '"nest-modules" <modules@nestjs.com>',
        },
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    ListenerModule,
    OutgoingHttpModule,
    MailAndSmsModule,
    CustomerModule,
    OrganizationModule,
    CurrencyModule,
    OrganizationOrderModule,
    CampaignModule,
    CustomerOrganizationOrderModule,
    CustomerWalletsModule,
    ShopModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: IncomingReqResLoggingInterceptor,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PrometheusMiddleware).exclude('metrics').forRoutes('*'); // Apply to all routes
  }
}
