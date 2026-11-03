import { UnauthorizedException } from '@nestjs/common';
import { CustomerSessionGuard } from './customer-session.guard';
import { PrismaService } from 'src/common/services/prismaService';

const executionContext = (authorization?: string) => {
  const request: any = { headers: { authorization } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    request,
  } as any;
};

describe('CustomerSessionGuard', () => {
  let authService: any;
  let prismaService: any;
  let guard: CustomerSessionGuard;

  beforeEach(() => {
    authService = {
      verifyCustomerSessionToken: jest.fn(),
      verifyJWT: jest.fn(),
    };
    prismaService = {
      customer: { findFirst: jest.fn() },
    };
    guard = new CustomerSessionGuard(authService, prismaService);
  });

  it('attaches the customer id and the tenant from the session token', async () => {
    authService.verifyCustomerSessionToken.mockResolvedValue({
      sub: 'cust-1',
      organizationId: 'org-1',
    });
    const context = executionContext('Bearer token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.verifyCustomerSessionToken).toHaveBeenCalledWith(
      'token',
    );
    expect(context.request.customerId).toBe('cust-1');
    expect(context.request.organizationId).toBe('org-1');
  });

  it('rejects a missing bearer token', async () => {
    await expect(
      guard.canActivate(executionContext(undefined)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a delegated token without a tenant', async () => {
    authService.verifyCustomerSessionToken.mockResolvedValue({
      sub: 'cust-1',
      organizationId: undefined,
    });

    await expect(
      guard.canActivate(executionContext('Bearer token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('legacy customer JWT', () => {
    it('resolves the tenant from the customer record', async () => {
      authService.verifyCustomerSessionToken.mockRejectedValue(
        new Error('not a session token'),
      );
      authService.verifyJWT.mockResolvedValue({
        sub: 'cust-1',
        userType: 'customer',
      });
      prismaService.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        organizationId: 'org-1',
      });
      const context = executionContext('Bearer legacy-token');

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(context.request.customerId).toBe('cust-1');
      expect(context.request.organizationId).toBe('org-1');
    });

    it('rejects a legacy token that belongs to an organization token', async () => {
      authService.verifyCustomerSessionToken.mockRejectedValue(
        new Error('not a session token'),
      );
      authService.verifyJWT.mockResolvedValue({
        sub: 'org-1',
        userType: 'organization',
      });

      await expect(
        guard.canActivate(executionContext('Bearer legacy-token')),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a legacy token for a customer that no longer exists', async () => {
      authService.verifyCustomerSessionToken.mockRejectedValue(
        new Error('not a session token'),
      );
      authService.verifyJWT.mockResolvedValue({
        sub: 'cust-1',
        userType: 'customer',
      });
      prismaService.customer.findFirst.mockResolvedValue(null);

      await expect(
        guard.canActivate(executionContext('Bearer legacy-token')),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
