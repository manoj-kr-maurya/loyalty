import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { CacheService } from 'src/common/services/cache/cache.service';

export interface CacheOptions {
  /**
   * TTL in seconds
   */
  ttl?: number;
  /**
   * Key prefix to use in addition to the request path
   */
  keyPrefix?: string;
  /**
   * Whether to include query params in cache key
   */
  includeQueryParams?: boolean;
  /**
   * Request headers to include in cache key
   */
  headersToCacheBy?: string[];
  /**
   * Request body fields to include in cache key
   */
  bodyFieldsToCacheBy?: string[];
}

/**
 * Interceptor that automatically caches HTTP responses
 * Can be applied to controllers or individual routes
 */
@Injectable()
export class CacheResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheResponseInterceptor.name);
  private readonly DEFAULT_TTL = 60; // 1 minute

  constructor(private cacheService: CacheService) {}

  /**
   * Create interceptor with specified options
   * @param options Caching options
   */
  static register(options: CacheOptions = {}) {
    @Injectable()
    class ConfiguredCacheInterceptor implements NestInterceptor {
      public readonly logger = new Logger(ConfiguredCacheInterceptor.name);
      public readonly ttl = options.ttl || 60; // 1 minute default

      constructor(public cacheService: CacheService) {}

      async intercept(
        context: ExecutionContext,
        next: CallHandler,
      ): Promise<Observable<any>> {
        // Only cache GET requests
        const request = context.switchToHttp().getRequest<Request>();
        if (request.method !== 'GET') {
          return next.handle();
        }

        // Build cache key
        const cacheKey = this.buildCacheKey(request, options);

        // Try to get from cache
        const cachedData = await this.cacheService.get(cacheKey);
        if (cachedData) {
          this.logger.debug(`Cache hit for: ${cacheKey}`);
          return of(cachedData);
        }

        // Cache miss - execute handler and cache result
        this.logger.debug(`Cache miss for: ${cacheKey}`);
        return next.handle().pipe(
          tap(async (data) => {
            try {
              await this.cacheService.set(cacheKey, data, this.ttl);
              this.logger.debug(`Cached response for: ${cacheKey}`);
            } catch (error) {
              this.logger.error(
                `Failed to cache response for: ${cacheKey}`,
                error,
              );
            }
          }),
        );
      }

      /**
       * Build a cache key based on request
       */
      public buildCacheKey(request: Request, options: CacheOptions): string {
        // Start with base path
        let key = request.path;

        // Add prefix if provided
        if (options.keyPrefix) {
          key = `${options.keyPrefix}:${key}`;
        }

        // Add relevant query params if enabled
        if (
          options.includeQueryParams &&
          Object.keys(request.query).length > 0
        ) {
          const queryString = Object.entries(request.query)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('&');
          key = `${key}?${queryString}`;
        }

        // Add relevant headers if specified
        if (options.headersToCacheBy?.length) {
          const headerValues = options.headersToCacheBy
            .map((header) => {
              const value = request.headers[header.toLowerCase()];
              return value ? `${header}=${value}` : null;
            })
            .filter(Boolean)
            .join(';');

          if (headerValues) {
            key = `${key}:headers:${headerValues}`;
          }
        }

        // Add body fields if specified and POST/PUT/PATCH request
        if (
          options.bodyFieldsToCacheBy?.length &&
          (request.method === 'POST' ||
            request.method === 'PUT' ||
            request.method === 'PATCH') &&
          request.body
        ) {
          const bodyValues = options.bodyFieldsToCacheBy
            .map((field) => {
              const value = request.body[field];
              return value !== undefined
                ? `${field}=${JSON.stringify(value)}`
                : null;
            })
            .filter(Boolean)
            .join(';');

          if (bodyValues) {
            key = `${key}:body:${bodyValues}`;
          }
        }

        return key;
      }
    }

    return ConfiguredCacheInterceptor;
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // Delegate to the configured version with default options
    const configuredInterceptor = CacheResponseInterceptor.register({
      ttl: this.DEFAULT_TTL,
    });
    return new configuredInterceptor(this.cacheService).intercept(
      context,
      next,
    );
  }
}
