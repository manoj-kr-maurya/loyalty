import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';
import { OrganizationAuthContext } from '../api-key.service';
import { REQUIRED_SCOPES_KEY } from '../decorators/require-scopes.decorator';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredScopes.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const auth: OrganizationAuthContext | undefined = request.organizationAuth;

    if (!auth) {
      throw new UnauthorizedException('Authentication context is missing');
    }

    if (auth.type === 'platform') return true;

    const granted = new Set(auth.scopes);
    const missing = requiredScopes.filter((scope) => !granted.has(scope));

    if (missing.length > 0) {
      throw new CommonException(
        `API key is missing required scope(s): ${missing.join(', ')}`,
        StatusCodes.FORBIDDEN,
      );
    }

    return true;
  }
}
