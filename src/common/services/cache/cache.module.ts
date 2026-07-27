import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { RedisCacheStrategy } from './strategies/redis-cache.strategy';
import { RedisClientAdapter } from './redis-client.adapter';

@Module({
  providers: [RedisCacheStrategy, CacheService, RedisClientAdapter],
  exports: [CacheService, RedisClientAdapter],
})
export class CustomCacheModule {}
