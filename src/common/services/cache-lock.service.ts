import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheLockService implements OnModuleDestroy {
  private readonly LOCK_PREFIX = 'lock_';

  constructor(@Inject(CACHE_MANAGER) private cacheService: Cache) {}

  async acquireLock(resource: string, ttl = 1000): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${resource}`;
    const lockValue = Date.now() + ttl;

    const existingLock = await this.cacheService.get<number>(lockKey);
    if (existingLock && existingLock > Date.now()) {
      return false; // Lock already acquired
    }

    await this.cacheService.set(lockKey, lockValue, ttl / 1000);
    return true; // Lock acquired
  }

  async releaseLock(resource: string): Promise<void> {
    const lockKey = `${this.LOCK_PREFIX}${resource}`;
    await this.cacheService.del(lockKey);
  }

  async waitForLockRelease(
    resource: string,
    timeout = 30000,
  ): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${resource}`;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const lockValue = await this.cacheService.get<number>(lockKey);
      if (!lockValue || lockValue <= Date.now()) {
        return true; // Lock released
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return false; // Timeout
  }

  async onModuleDestroy() {
    // Cleanup logic if necessary
  }
}
