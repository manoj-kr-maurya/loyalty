import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { envEnums } from 'src/config/enums';

/**
 * Restricts a route to the platform-owned ADMIN_API_KEY.
 *
 * Organization-scoped keys are deliberately rejected: cross-tenant
 * administrative operations must never be reachable with a tenant key.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const platformKey = this.configService.get<string>(envEnums.ADMIN_API_KEY);

    if (!apiKey || Array.isArray(apiKey) || !platformKey) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    if (!this.safeEqual(apiKey, platformKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.organizationAuth = {
      type: 'platform',
      scopes: ['*'],
    };

    return true;
  }

  private safeEqual(value: string, expected: string): boolean {
    const actual = Buffer.from(value);
    const target = Buffer.from(expected);

    if (actual.length !== target.length) return false;

    return timingSafeEqual(actual, target);
  }
}
