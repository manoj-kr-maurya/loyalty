import { CacheService } from '../services/cache/cache.service';
import { Inject } from '@nestjs/common';

export interface CacheOptions {
  /**
   * TTL in seconds
   */
  ttl?: number;
  /**
   * Service name for cache key
   */
  serviceName?: string;
  /**
   * Method name for cache key (defaults to decorated method name)
   */
  methodName?: string;
  /**
   * Specific cache key to use (if provided, serviceName and methodName are ignored)
   */
  cacheKey?: string;
  /**
   * Function to extract parameters to include in cache key
   * If not provided, all parameters are used
   */
  cacheKeyParams?: (args: any[]) => any;
}

/**
 * Cache decorator for methods
 * @param options Cache options
 */
export function Cacheable(options: CacheOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    // The cache service will be injected dynamically
    const cacheServiceToken = Symbol('CACHE_SERVICE_TOKEN');
    Inject(CacheService)(target, cacheServiceToken);

    descriptor.value = async function (...args: any[]) {
      // Get the injected cache service
      const cacheService: CacheService = (this as any)[cacheServiceToken];

      if (!cacheService) {
        console.warn(
          `Cache service not available for ${propertyKey}, falling back to original method`,
        );
        return originalMethod.apply(this, args);
      }

      // Build cache key
      let cacheKey: string;

      if (options.cacheKey) {
        cacheKey = options.cacheKey;
      } else {
        const serviceName = options.serviceName || this.constructor.name;
        const methodName = options.methodName || propertyKey;

        // Get parameters to include in the cache key
        const params = options.cacheKeyParams
          ? options.cacheKeyParams(args)
          : args.length > 0
          ? args[0]
          : undefined;

        cacheKey = cacheService.buildCacheKey(serviceName, methodName, params);
      }

      // Use the cache wrapper to handle caching
      return cacheService.cacheWrapper(
        cacheKey,
        () => originalMethod.apply(this, args),
        options.ttl || 60,
      );
    };

    return descriptor;
  };
}

/**
 * Invalidates cache when the method is called
 * @param patterns Array of cache key patterns to invalidate
 */
export function InvalidateCache(patterns: string[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    // The cache service will be injected dynamically
    const cacheServiceToken = Symbol('CACHE_SERVICE_TOKEN');
    Inject(CacheService)(target, cacheServiceToken);

    descriptor.value = async function (...args: any[]) {
      // Execute the original method
      const result = await originalMethod.apply(this, args);

      // Get the injected cache service
      const cacheService: CacheService = (this as any)[cacheServiceToken];

      if (!cacheService) {
        console.warn(
          `Cache service not available for ${propertyKey}, skipping cache invalidation`,
        );
        return result;
      }

      // Invalidate all specified patterns
      for (const pattern of patterns) {
        await cacheService.invalidateCacheByPattern(pattern);
      }

      return result;
    };

    return descriptor;
  };
}
