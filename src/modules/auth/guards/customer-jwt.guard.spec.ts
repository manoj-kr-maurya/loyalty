import { UnauthorizedException } from '@nestjs/common';
import { CustomerJwtGuard } from './customer-jwt.guard';

const executionContext = (authorization?: string) => {
  const request: any = { headers: { authorization } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    request,
  } as any;
};

describe('CustomerJwtGuard', () => {
  let authService: any;
  let guard: CustomerJwtGuard;

  beforeEach(() => {
    authService = { verifyJWT: jest.fn() };
    guard = new CustomerJwtGuard(authService);
  });

  it('attaches the customer id from a customer token', async () => {
    authService.verifyJWT.mockResolvedValue({
      sub: 'cust-1',
      userType: 'Customer',
    });
    const context = executionContext('Bearer token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.verifyJWT).toHaveBeenCalledWith('token');
    expect(context.request.customerId).toBe('cust-1');
  });

  it('rejects an organization token', async () => {
    authService.verifyJWT.mockResolvedValue({
      sub: 'org-1',
      userType: 'Organization',
    });

    await expect(
      guard.canActivate(executionContext('Bearer token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a missing bearer token', async () => {
    await expect(
      guard.canActivate(executionContext(undefined)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
