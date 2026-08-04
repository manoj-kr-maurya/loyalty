import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

/**
 * Adapter class for direct Redis client operations
 * Provides access to Redis commands not available through cache-manager
 */
@Injectable()
export class RedisClientAdapter {
  private readonly logger = new Logger(RedisClientAdapter.name);
  private readonly redisClient: any;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    // Access the underlying Redis client
    this.redisClient = (cacheManager as any).store.client;

    if (!this.redisClient) {
      this.logger.warn(
        'Redis client not available, some operations will not work',
      );
    } else {
      // Gracefully handle Redis connection errors so they don't crash the app
      this.redisClient.on('error', (err: Error) => {
        this.logger.error(`Redis client error: ${err.message}`);
      });
    }
  }

  /**
   * Check if Redis client is available
   */
  isClientAvailable(): boolean {
    return !!this.redisClient;
  }

  /**
   * Get all keys matching a pattern
   * @param pattern Pattern to match (e.g., "user:*")
   * @returns Array of matching keys
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.isClientAvailable()) {
      this.logger.warn(
        `Redis client not available, cannot get keys for pattern: ${pattern}`,
      );
      return [];
    }

    try {
      return await this.redisClient.keys(pattern);
    } catch (error) {
      this.logger.error(
        `Error getting Redis keys with pattern: ${pattern}`,
        error,
      );
      return [];
    }
  }

  /**
   * Get the TTL (time to live) for a key
   * @param key Redis key
   * @returns TTL in seconds, -1 if key exists but has no TTL, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    if (!this.isClientAvailable()) {
      this.logger.warn(
        `Redis client not available, cannot get TTL for key: ${key}`,
      );
      return -2;
    }

    try {
      return await this.redisClient.ttl(key);
    } catch (error) {
      this.logger.error(`Error getting TTL for Redis key: ${key}`, error);
      return -2;
    }
  }

  /**
   * Set the TTL for an existing key
   * @param key Redis key
   * @param seconds TTL in seconds
   * @returns 1 if set, 0 if key doesn't exist
   */
  async expire(key: string, seconds: number): Promise<number> {
    if (!this.isClientAvailable()) {
      this.logger.warn(
        `Redis client not available, cannot set TTL for key: ${key}`,
      );
      return 0;
    }

    try {
      return await this.redisClient.expire(key, seconds);
    } catch (error) {
      this.logger.error(`Error setting TTL for Redis key: ${key}`, error);
      return 0;
    }
  }

  /**
   * Get multiple values at once
   * @param keys Array of Redis keys
   * @returns Array of values in the same order as keys
   */
  async mget(keys: string[]): Promise<any[]> {
    if (!this.isClientAvailable()) {
      this.logger.warn(`Redis client not available, cannot get multiple keys`);
      return new Array(keys.length).fill(null);
    }

    if (!keys.length) {
      return [];
    }

    try {
      return await this.redisClient.mget(keys);
    } catch (error) {
      this.logger.error(`Error getting multiple Redis keys`, error);
      return new Array(keys.length).fill(null);
    }
  }

  /**
   * Get Redis info (server statistics)
   * @param section Optional section name (e.g., "server", "clients", "memory")
   * @returns Redis info object
   */
  async info(section?: string): Promise<any> {
    if (!this.isClientAvailable()) {
      this.logger.warn(`Redis client not available, cannot get Redis info`);
      return null;
    }

    try {
      return await this.redisClient.info(section);
    } catch (error) {
      this.logger.error(`Error getting Redis info`, error);
      return null;
    }
  }

  /**
   * Get Redis server time
   * @returns Server time as [seconds, microseconds]
   */
  async time(): Promise<[number, number]> {
    if (!this.isClientAvailable()) {
      this.logger.warn(`Redis client not available, cannot get Redis time`);
      return [0, 0];
    }

    try {
      return await this.redisClient.time();
    } catch (error) {
      this.logger.error(`Error getting Redis time`, error);
      return [0, 0];
    }
  }

  /**
   * Execute a raw Redis command
   * Use sparingly and only for commands not available through other methods
   * @param command Redis command name
   * @param args Command arguments
   * @returns Command result
   */
  async executeCommand(command: string, ...args: any[]): Promise<any> {
    if (!this.isClientAvailable()) {
      this.logger.warn(
        `Redis client not available, cannot execute Redis command: ${command}`,
      );
      return null;
    }

    try {
      return await this.redisClient.sendCommand(command, args);
    } catch (error) {
      this.logger.error(`Error executing Redis command: ${command}`, error);
      return null;
    }
  }
}
