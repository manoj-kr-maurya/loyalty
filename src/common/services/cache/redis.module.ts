import { Global, Module } from '@nestjs/common';
import { RedisClientProvider } from './redis-client.provider';
import { REDIS_CLIENT } from './redis-client.constants';

/**
 * Global module that owns the process-wide Redis client and exposes it via the
 * REDIS_CLIENT injection token. Marked @Global() so any module (including the
 * CacheModule factory in app.module) can inject the same client instance.
 */
@Global()
@Module({
  providers: [
    RedisClientProvider,
    {
      provide: REDIS_CLIENT,
      useFactory: (provider: RedisClientProvider) => provider.clientInstance,
      inject: [RedisClientProvider],
    },
  ],
  exports: [RedisClientProvider, REDIS_CLIENT],
})
export class RedisModule {}