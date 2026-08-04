import { MailerModule } from '@nestjs-modules/mailer';
import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { envEnums } from './config/enums';
import { envSchema } from './config/env-schema';
import { IncomingReqResLoggingInterceptor } from './interceptors/log/incoming-req-res-logger.interceptor';
import { CurrencyModule } from './modules/domain/currency/currency.module';
import { CustomerModule } from './modules/domain/customer/customer.module';
import { CustomerOrganizationOrderModule } from './modules/domain/customer-organization-order/customer-organization-order.module';
import { MailAndSmsModule } from './modules/domain/mail-and-sms/mail-and-sms.module';
import { OrganizationModule } from './modules/domain/organization/organization.module';
import { OrganizationOrderModule } from './modules/domain/organization-order/organization-order.module';
import { HealthModule } from './modules/health/health.module';
import { OutgoingHttpModule } from './modules/http/http.module';
import { redisInsStore } from 'cache-manager-redis-yet';
import { REDIS_CLIENT } from './common/services/cache/redis-client.constants';
import { RedisModule } from './common/services/cache/redis.module';
import { AdminModule } from './modules/domain/admin/admin.module';
import { PointsModule } from './modules/domain/points/points.module';
import { PromoModule } from './modules/domain/promo/promo.module';
import { PrometheusMiddleware } from './middlewares/prometheus.middleware';
import { ListenerModule } from './modules/listener/listener.module';
import { ShopModule } from './modules/domain/shop/shop.module';
import { FXEngineModule } from './modules/domain/productised-commercial-engines/fx-engine';
import { LoyaltyEngineModule } from './modules/domain/productised-commercial-engines/loyalty-engine';
import { PromoEngineModule } from './modules/domain/productised-commercial-engines/promo-engine';
import { PLBEngineModule } from './modules/domain/productised-commercial-engines/plb-engine';
import { ValueExchangeEngineModule } from './modules/domain/productised-commercial-engines/value-exchange-engine';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
      validationSchema: envSchema,
    }),
    RedisModule,
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (configService: ConfigService, redisClient: any) => {
        // Wrap the shared, lifecycle-managed Redis client (see RedisModule /
        // RedisClientProvider) into a cache-manager store. The store must be
        // returned as an object directly — `{ store: () => store }` breaks
        // cache-manager v5 (store.set/get/client become undefined).
        const store = redisInsStore(redisClient);

        return { store };
      },
      inject: [ConfigService, REDIS_CLIENT],
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
    PromoModule,
    CustomerOrganizationOrderModule,
    PointsModule,
    ShopModule,
    AdminModule,
    // ─── Productised Commercial Engines ─────────────────
    FXEngineModule,
    LoyaltyEngineModule,
    PromoEngineModule,
    PLBEngineModule,
    ValueExchangeEngineModule,
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
