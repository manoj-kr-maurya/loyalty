import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { RedisClientProvider } from 'src/common/services/cache/redis-client.provider';
import { RedisService } from 'src/common/services/cache/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly redisClientProvider: RedisClientProvider,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Fast check: is the client socket ready? Avoids false failures during
      // an in-progress reconnect even when Redis is about to come back.
      if (!this.redisClientProvider.isReady()) {
        throw new Error('Redis client is not ready (reconnecting/disconnected)');
      }

      // End-to-end check: set + retrieve a test value through cache-manager.
      const testKey = 'health:test';
      const testValue = Date.now().toString();

      await this.redisService.set(testKey, testValue, 5);
      const retrieved = await this.redisService.get<string>(testKey);

      if (retrieved !== testValue) {
        throw new Error('Redis value mismatch: Redis is not working correctly');
      }

      return this.getStatus(key, true, { ready: true });
    } catch (error) {
      this.logger.error(
        `Redis health check failed: ${error.message}`,
        error.stack,
      );

      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, { message: error.message }),
      );
    }
  }
}
