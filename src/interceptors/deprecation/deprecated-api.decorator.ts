import { SetMetadata } from '@nestjs/common';

export const DEPRECATED_API_KEY = 'deprecatedApi';

export interface DeprecatedApiOptions {
  /** ISO date after which the route may be removed. */
  sunset?: string;
  /** Canonical replacement route. */
  replacement?: string;
}

/**
 * Marks a controller or handler as deprecated. The interceptor emits standard
 * `Deprecation`, `Sunset`, and `Link` response headers so clients can migrate.
 */
export const DeprecatedApi = (options: DeprecatedApiOptions = {}) =>
  SetMetadata(DEPRECATED_API_KEY, options);
