import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserTypes } from 'src/common/enums/user-types';
import { PrismaService } from 'src/common/services/prismaService';
import { AuthService } from '../auth.service';

/**
 * Authenticates customer-facing calls with a customer session token.
 *
 * Two token shapes are accepted:
 *
 * 1. A delegated session token, minted by this engine for a customer that the
 *    tenant has already authenticated. It is audience bound, short lived and
 *    carries the tenant it was issued for.
 * 2. A legacy customer JWT, produced by the deprecated shopper OTP flow. The
 *    tenant is resolved from the customer record itself, because a customer
 *    belongs to exactly one tenant.
 *
 * Either way the customer id comes from the token, never from the URL or the
 * body, and every query the handler runs can be scoped to one tenant.
 */
@Injectable()
export class CustomerSessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization: string | undefined = request.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Please provide a bearer token');
    }

    const token = authorization.slice('Bearer '.length).trim();
    const { customerId, organizationId } = await this.resolveSession(token);

    if (!customerId || !organizationId) {
      throw new UnauthorizedException('Invalid customer session token');
    }

    request.customerId = customerId;
    request.organizationId = organizationId;
    request.tokenPayload = { sub: customerId, organizationId };

    return true;
  }

  private async resolveSession(token: string): Promise<{
    customerId: string;
    organizationId: string;
  }> {
    try {
      const session = await this.authService.verifyCustomerSessionToken(token);
      return {
        customerId: session.sub,
        organizationId: session.organizationId,
      };
    } catch {
      // Not a delegated session token, fall through to the legacy JWT.
    }

    const payload = await this.authService.verifyJWT(token);
    if (
      !payload?.sub ||
      String(payload.userType).toLowerCase() !== UserTypes.customer
    ) {
      throw new UnauthorizedException('Customer token required');
    }

    const customer = await this.prismaService.customer.findFirst({
      where: { id: payload.sub },
      select: { id: true, organizationId: true },
    });

    if (!customer) {
      throw new UnauthorizedException('Invalid customer session token');
    }

    return {
      customerId: customer.id,
      organizationId: customer.organizationId,
    };
  }
}
