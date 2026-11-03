import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserTypes } from 'src/common/enums/user-types';
import { AuthService } from '../auth.service';

/**
 * Authenticates tenant staff calls with an organization JWT.
 *
 * The JWT session is verified (signature + Redis session) and the token's
 * userType must be an organization. The resolved organization id is attached
 * to the request so handlers never trust an organization id from the body.
 */
@Injectable()
export class OrganizationJwtGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization: string | undefined = request.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Please provide a bearer token');
    }

    const token = authorization.slice('Bearer '.length).trim();
    const payload = await this.authService.verifyJWT(token);

    if (
      !payload?.sub ||
      String(payload.userType).toLowerCase() !== UserTypes.organization
    ) {
      throw new UnauthorizedException('Organization token required');
    }

    request.organizationId = payload.sub;
    request.tokenPayload = payload;

    return true;
  }
}
