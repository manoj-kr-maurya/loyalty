import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';
import { OrganizationAuthContext } from 'src/modules/auth/api-key.service';

const TENANT_KEYS = [
  'organizationId',
  'orgId',
  'tenantId',
  'sourceEntityId',
] as const;

/**
 * Transitional tenant enforcement for legacy controllers that still read the
 * tenant from the URL, query string, or body.
 *
 * Organization keys may only reference their own tenant. Platform keys bypass
 * this check. This runs before pipes/handlers, so it closes cross-tenant
 * references without rewriting every legacy DTO.
 */
@Injectable()
export class TenantScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest();
    const auth: OrganizationAuthContext | undefined = request.organizationAuth;

    if (auth?.type !== 'organization' || !auth.organizationId) {
      return next.handle();
    }

    const sources = [request.params, request.query, request.body];

    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;

      for (const key of TENANT_KEYS) {
        const value = source[key];

        if (
          typeof value === 'string' &&
          value.length > 0 &&
          value !== auth.organizationId
        ) {
          throw new CommonException(
            'API key does not grant access to this organization',
            StatusCodes.FORBIDDEN,
          );
        }
      }
    }

    return next.handle();
  }
}
