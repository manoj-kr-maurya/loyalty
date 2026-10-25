import { MailerModule } from '@nestjs-modules/mailer';
import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { envEnums } from 'src/config/enums';
import { envSchema } from 'src/config/env-schema';
import { IncomingReqResLoggingInterceptor } from './interceptors/log/incoming-req-res-logger.interceptor';
import { TenantScopeInterceptor } from './interceptors/tenant/tenant-scope.interceptor';
import { DeprecationInterceptor } from './interceptors/deprecation/deprecation.interceptor';
import { CurrencyModule } from './modules/currency/currency.module';
import { CustomerModule } from './modules/customer/customer.module';
import { CustomerOrganizationOrderModule } from './modules/customer-organization-order/customer-organization-order.module';
import { MailAndSmsModule } from './modules/mail-and-sms/mail-and-sms.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { OrganizationOrderModule } from './modules/organization-order/organization-order.module';
import { HealthModule } from './modules/health/health.module';
import { OutgoingHttpModule } from './modules/http/http.module';
import { redisInsStore } from 'cache-manager-redis-yet';
import { REDIS_CLIENT } from 'src/common/services/cache/redis-client.constants';
import { RedisModule } from 'src/common/services/cache/redis.module';
import { AdminModule } from './modules/admin/admin.module';
import { PointsModule } from './modules/points/points.module';
import { PromoModule } from './modules/promo/promo.module';
import { PrometheusMiddleware } from './middlewares/prometheus.middleware';
import { ListenerModule } from './modules/listener/listener.module';
import { ShopModule } from './modules/shop/shop.module';
import { FXEngineModule } from './engines/fx-engine';
import { LoyaltyEngineModule } from './engines/loyalty-engine';
import { PLBEngineModule } from './engines/plb-engine';
import { ValueExchangeEngineModule } from './engines/value-exchange-engine';

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
    PLBEngineModule,
    ValueExchangeEngineModule,
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 120,
    }),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IncomingReqResLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantScopeInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DeprecationInterceptor,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PrometheusMiddleware).exclude('metrics').forRoutes('*'); // Apply to all routes
  }
}
