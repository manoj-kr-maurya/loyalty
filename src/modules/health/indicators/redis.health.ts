import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { RedisService } from 'src/common/services/cache/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Test Redis connection by setting and retrieving a test value
      const testKey = 'health:test';
      const testValue = Date.now().toString();

      await this.redisService.set(testKey, testValue, 5);
      const retrieved = await this.redisService.get<string>(testKey);

      if (retrieved !== testValue) {
        throw new Error('Redis value mismatch: Redis is not working correctly');
      }

      return this.getStatus(key, true);
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
