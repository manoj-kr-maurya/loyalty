/**
 * EXAMPLE FILE - Demonstrates how to use the caching system in other services
 *
 * This is not for actual use, but as a reference for implementing caching in other services
 */

import { Injectable } from '@nestjs/common';
import { CacheService } from 'src/common/services/cache/cache.service';
import { CustomerService } from '../customer.service';
import {
  Cacheable,
  InvalidateCache,
} from 'src/common/decorators/cache.decorator';

/**
 * Example service showing how to implement caching and cache invalidation
 */
@Injectable()
export class ExampleOrderService {
  // Define cache keys at the class level for consistency
  private readonly CACHE_PREFIX = 'order';
  private readonly ORDER_CACHE_KEY = `${this.CACHE_PREFIX}:details`;

  constructor(
    private readonly cacheService: CacheService,
    private readonly customerService: CustomerService, // Inject any services that need cache invalidation
  ) {}

  /**
   * Example of using the @Cacheable decorator
   */
  @Cacheable({
    ttl: 300, // 5 minutes cache
    serviceName: 'ExampleOrderService',
    methodName: 'getOrderById',
    cacheKeyParams: (args) => ({ id: args[0] }),
  })
  async getOrderById(orderId: string) {
    // This is where your database call would normally happen
    return {
      id: orderId,
      status: 'PENDING',
      items: [],
      total: 0,
      // Other order data
    };
  }

  /**
   * Example of using the CacheService directly
   */
  async getAllOrders(customerId: string) {
    const cacheKey = `${this.CACHE_PREFIX}:customer:${customerId}:all`;

    return this.cacheService.cacheWrapper(
      cacheKey,
      async () => {
        // This is where your database call would normally happen
        return [
          { id: '1', status: 'COMPLETED' },
          { id: '2', status: 'PENDING' },
        ];
      },
      600, // 10 minutes TTL
    );
  }

  /**
   * Example of using the @InvalidateCache decorator
   * This will invalidate the specified cache patterns when the method is called
   */
  @InvalidateCache([
    'order:*', // Invalidate all order-related caches
    'customer:leaderboard:*', // Invalidate the leaderboard cache too
  ])
  async completeOrder(orderId: string) {
    // This is where your database update would happen

    // If you need to invalidate leaderboard cache specifically
    // You can also do it manually:
    await this.customerService.invalidateLeaderboardCache();

    return { success: true };
  }

  /**
   * Example of manual cache management for complex scenarios
   */
  async processOrderBatch(orders: string[]) {
    // Process the orders

    // Manually invalidate specific keys
    for (const orderId of orders) {
      await this.cacheService.invalidateCache(
        `${this.ORDER_CACHE_KEY}:${orderId}`,
      );
    }

    // Invalidate other related caches
    await this.cacheService.invalidateCacheByPattern('customer:leaderboard:*');

    return { processed: orders.length };
  }
}

/**
 * Example of how to use the cache interceptor for controllers
 */
/*
@Get('/orders/:id')
@UseInterceptors(
  CacheResponseInterceptor.register({
    ttl: 300, // 5 minutes
    keyPrefix: 'api:order',
    includeQueryParams: true,
  })
)
async getOrder(@Param('id') id: string) {
  return this.orderService.getOrderById(id);
}
*/

/**
 * Example of how to handle cache invalidation in other services
 * that affect the leaderboard
 */
/*
@Injectable()
export class CustomerEarningService {
  constructor(
    private readonly customerService: CustomerService,
  ) {}
  
  @InvalidateCache(['customer:leaderboard:*'])
  async addEarningPoints(customerId: string, points: number) {
    // Database operations
    
    // You can also invalidate manually if needed
    // await this.customerService.invalidateLeaderboardCache();
    
    return { success: true };
  }
}
*/
