# Caching Infrastructure

This directory contains a comprehensive caching solution for the loyalty engine microservice. The caching system is built using Redis and provides multiple ways to implement caching based on your specific needs.

## Core Components

### 1. Cache Strategies

The caching infrastructure uses a strategy pattern to allow different caching implementations:

- `CacheStrategy` - Interface defining the required methods for any cache implementation
- `RedisCacheStrategy` - Redis implementation of the cache strategy

This approach makes it easy to add new cache providers in the future (e.g., in-memory, Memcached) without changing the core caching logic.

### 2. Cache Service

The `CacheService` provides a high-level API for caching operations:

- `cacheWrapper` - A method that handles the cache get/set logic for you
- `buildCacheKey` - Helper to create consistent cache keys
- `invalidateCache` - Method to remove specific cache entries
- `invalidateCacheByPattern` - Method to remove multiple cache entries matching a pattern

### 3. Decorators

Two decorators are available for easy integration with your services:

- `@Cacheable()` - Adds caching to any method with configurable TTL and key generation
- `@InvalidateCache()` - Invalidates specified cache patterns when a method is called

### 4. Interceptor

The `CacheResponseInterceptor` provides HTTP response caching at the controller level:

- Can be applied to specific routes or entire controllers
- Handles cache key generation based on request path, headers, and query parameters
- Configurable TTL and other options

## How to Use

### 1. Service Method Caching (Recommended)

```typescript
import { Cacheable } from 'src/common/decorators/cache.decorator';

@Injectable()
export class YourService {
  @Cacheable({
    ttl: 60, // 1 minute
    serviceName: 'YourService',
    methodName: 'yourMethod',
    cacheKeyParams: (args) => ({ id: args[0], filter: args[1] }),
  })
  async yourMethod(id: string, filter: any) {
    // Database or other expensive operations here
    return result;
  }
}
```

### 2. Controller-Level Caching

```typescript
import { CacheResponseInterceptor } from 'src/interceptors/cache/cache-response.interceptor';

@Get('/your-endpoint')
@UseInterceptors(
  CacheResponseInterceptor.register({
    ttl: 60, // 1 minute
    keyPrefix: 'api:your-feature',
    includeQueryParams: true,
  })
)
async yourEndpoint() {
  return this.yourService.getData();
}
```

### 3. Manual Caching

```typescript
import { CacheService } from 'src/common/services/cache/cache.service';

@Injectable()
export class YourService {
  constructor(private readonly cacheService: CacheService) {}

  async getData(id: string) {
    const cacheKey = `your-feature:${id}`;

    return this.cacheService.cacheWrapper(
      cacheKey,
      async () => {
        // Expensive operation
        return fetchFromDatabase(id);
      },
      60, // 1 minute TTL
    );
  }
}
```

### 4. Cache Invalidation

```typescript
import { InvalidateCache } from 'src/common/decorators/cache.decorator';

@Injectable()
export class YourService {
  constructor(private readonly cacheService: CacheService) {}

  @InvalidateCache(['your-feature:*'])
  async updateData(id: string, data: any) {
    // Update in database

    // You can also manually invalidate specific keys
    await this.cacheService.invalidateCache(`specific-key:${id}`);

    return result;
  }
}
```

## Best Practices

1. **Consistent Key Naming**: Use consistent prefixes for related data (e.g., `customer:`, `order:`)
2. **Appropriate TTL**: Choose appropriate TTL values based on data volatility and access patterns
3. **Selective Caching**: Only cache data that is:
   - Expensive to compute
   - Accessed frequently
   - Relatively stable (doesn't change too often)
4. **Proper Invalidation**: Always invalidate related caches when data changes
5. **Error Handling**: The cache system is designed to fail gracefully, falling back to the original data source if caching fails
