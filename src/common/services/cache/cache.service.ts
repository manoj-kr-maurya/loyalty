import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheStrategy } from './strategies/redis-cache.strategy';

/**
 * Cache service that handles caching operations using the selected strategy
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly cacheStrategy: RedisCacheStrategy) {}

  /**
   * Wrapper function to cache API responses
   * @param key - Unique cache key
   * @param fetchDataFn - Function to fetch data if cache miss
   * @param ttlInSeconds - Time to live in seconds (default: 60s)
   * @returns The cached data or freshly fetched data
   */
  async cacheWrapper<T>(
    key: string,
    fetchDataFn: () => Promise<T>,
    ttlInSeconds = 60,
  ): Promise<T> {
    try {
      // Try to get data from cache
      const cachedData = await this.cacheStrategy.get<T>(key);

      // If data exists in cache, return it
      if (cachedData) {
        return cachedData;
      }

      // Cache miss, fetch fresh data
      const freshData = await fetchDataFn();

      // Store fresh data in cache
      await this.cacheStrategy.set(key, freshData, ttlInSeconds);

      return freshData;
    } catch (error) {
      // If there's any cache-related error, fallback to direct data fetch
      this.logger.error(`Cache error for key: ${key}`, error);
      return fetchDataFn();
    }
  }

  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Value from cache or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    return this.cacheStrategy.get<T>(key);
  }

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Time to live in seconds
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    return this.cacheStrategy.set(key, value, ttl);
  }

  /**
   * Delete a specific cache entry
   * @param key - Cache key to invalidate
   */
  async invalidateCache(key: string): Promise<void> {
    try {
      await this.cacheStrategy.delete(key);
      this.logger.debug(`Cache invalidated for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error invalidating cache for key: ${key}`, error);
    }
  }

  /**
   * Delete a specific cache entry
   * @param key - Cache key to invalidate
   */
  async delete(key: string): Promise<void> {
    return this.invalidateCache(key);
  }

  /**
   * Invalidate multiple cache entries based on a pattern
   * @param pattern - Pattern for cache keys to invalidate
   */
  async invalidateCacheByPattern(pattern: string): Promise<void> {
    try {
      const count = await this.cacheStrategy.deleteByPattern(pattern);
      this.logger.debug(
        `Invalidated ${count} cache entries for pattern: ${pattern}`,
      );
    } catch (error) {
      this.logger.error(
        `Error invalidating cache for pattern: ${pattern}`,
        error,
      );
    }
  }

  /**
   * Reset the entire cache
   */
  async reset(): Promise<void> {
    return this.cacheStrategy.reset();
  }

  /**
   * Builds a cache key based on service name, method name and parameters
   * @param serviceName - Name of the service
   * @param methodName - Name of the method
   * @param params - Optional parameters that affect the result
   * @returns Formatted cache key
   */
  buildCacheKey(
    serviceName: string,
    methodName: string,
    params?: Record<string, any>,
  ): string {
    const baseKey = `${serviceName}:${methodName}`;

    if (!params || Object.keys(params).length === 0) {
      return baseKey;
    }

    // Sort params for consistent cache keys
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        // Filter out undefined values
        if (params[key] !== undefined) {
          result[key] = params[key];
        }
        return result;
      }, {} as Record<string, any>);

    // Create a hash from the params
    const paramsHash = JSON.stringify(sortedParams);
    return `${baseKey}:${paramsHash}`;
  }
}
