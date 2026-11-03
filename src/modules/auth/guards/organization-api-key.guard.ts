import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { envEnums } from 'src/config/enums';
import { ApiKeyService } from '../api-key.service';

/**
 * Authenticates server-to-server calls with an organization-scoped API key.
 *
 * A valid organization key binds the request to that tenant. The platform
 * ADMIN_API_KEY is still accepted for trusted back-office operations and is
 * marked as `type: 'platform'`, which allows explicit cross-tenant access.
 */
@Injectable()
export class OrganizationApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || Array.isArray(apiKey)) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const platformKey = this.configService.get<string>(envEnums.ADMIN_API_KEY);

    if (platformKey && this.safeEqual(apiKey, platformKey)) {
      request.organizationAuth = {
        type: 'platform',
        scopes: ['*'],
      };
      return true;
    }

    const authContext = await this.apiKeyService.validate(apiKey);

    if (!authContext) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    request.organizationAuth = authContext;
    return true;
  }

  private safeEqual(value: string, expected: string): boolean {
    const actual = Buffer.from(value);
    const target = Buffer.from(expected);

    if (actual.length !== target.length) return false;

    return timingSafeEqual(actual, target);
  }
}
