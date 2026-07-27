/**
 * Interface for cache strategies
 */
export interface CacheStrategy {
  /**
   * Get a value from the cache
   * @param key - Cache key
   * @returns Value from cache or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in the cache
   * @param key - Cache key
   * @param value - Value to store
   * @param ttl - Time to live in seconds
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a value from the cache
   * @param key - Cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Delete multiple values by pattern
   * @param pattern - Pattern to match keys
   * @returns Number of keys deleted
   */
  deleteByPattern(pattern: string): Promise<number>;

  /**
   * Reset the entire cache
   */
  reset(): Promise<void>;
}
