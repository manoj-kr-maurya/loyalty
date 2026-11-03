import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';
import { OrganizationAuthContext } from './api-key.service';

/**
 * Resolves the effective organization for a request.
 *
 * Organization keys are hard-bound to their tenant: a caller-supplied
 * organizationId is only accepted when it matches the key. Platform keys may
 * act on any tenant and therefore must supply one explicitly.
 */
export function resolveOrganizationId(
  auth: OrganizationAuthContext | undefined,
  requestedOrganizationId?: string,
): string {
  if (!auth) {
    throw new CommonException(
      'Authentication context is missing',
      StatusCodes.UNAUTHORIZED,
    );
  }

  if (auth.type === 'platform') {
    if (!requestedOrganizationId) {
      throw new CommonException(
        'organizationId is required when using a platform key',
        StatusCodes.BAD_REQUEST,
      );
    }

    return requestedOrganizationId;
  }

  if (!auth.organizationId) {
    throw new CommonException(
      'API key is not bound to an organization',
      StatusCodes.UNAUTHORIZED,
    );
  }

  if (
    requestedOrganizationId &&
    requestedOrganizationId !== auth.organizationId
  ) {
    throw new CommonException(
      'API key does not grant access to this organization',
      StatusCodes.FORBIDDEN,
    );
  }

  return auth.organizationId;
}
