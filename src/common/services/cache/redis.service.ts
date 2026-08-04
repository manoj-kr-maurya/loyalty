import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from './redis-client.constants';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly redisClient: any;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(REDIS_CLIENT) private readonly client: any,
    private readonly configService: ConfigService,
  ) {
    // Use the shared, lifecycle-managed Redis client for pattern operations
    this.redisClient = client;
  }

  /**
   * Set a value in Redis with expiry time
   * @param key - Redis key
   * @param value - Value to store
   * @param ttlInSeconds - Expiry time in seconds (default: 60 seconds)
   */
  async set(key: string, value: any, ttlInSeconds = 60): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttlInSeconds * 1000);
      this.logger.debug(
        `Set cache for key: ${key} with TTL: ${ttlInSeconds} seconds`,
      );
    } catch (error) {
      this.logger.error(`Error setting Redis key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Get a value from Redis
   * @param key - Redis key
   * @returns Parsed value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      return value || null;
    } catch (error) {
      this.logger.error(`Error getting Redis key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete a value from Redis
   * @param key - Redis key
   */
  async delete(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Deleted cache for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting Redis key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * @param pattern - Pattern to match keys (e.g., "user:*")
   * @returns Number of keys deleted
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      if (!this.redisClient) {
        this.logger.warn('Redis client not available for pattern operations');
        return 0;
      }

      // Find all keys matching the pattern
      const keys = await this.redisClient.keys(pattern);

      if (!keys || keys.length === 0) {
        this.logger.debug(`No keys found matching pattern: ${pattern}`);
        return 0;
      }

      // Delete all found keys
      const count = await this.redisClient.del(keys);
      this.logger.debug(`Deleted ${count} keys matching pattern: ${pattern}`);
      return count;
    } catch (error) {
      this.logger.error(
        `Error deleting Redis keys with pattern: ${pattern}`,
        error,
      );
      return 0;
    }
  }

  /**
   * Reset the cache (delete all keys)
   */
  async reset(): Promise<void> {
    try {
      await this.cacheManager.reset();
      this.logger.debug('Reset all cache');
    } catch (error) {
      this.logger.error('Error resetting Redis cache', error);
      throw error;
    }
  }
}
