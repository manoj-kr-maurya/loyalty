import { UnauthorizedException } from '@nestjs/common';
import { OrganizationJwtGuard } from './organization-jwt.guard';

const executionContext = (authorization?: string) => {
  const request: any = { headers: { authorization } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    request,
  } as any;
};

describe('OrganizationJwtGuard', () => {
  let authService: any;
  let guard: OrganizationJwtGuard;

  beforeEach(() => {
    authService = { verifyJWT: jest.fn() };
    guard = new OrganizationJwtGuard(authService);
  });

  it('attaches the organization id from an organization token', async () => {
    authService.verifyJWT.mockResolvedValue({
      sub: 'org-1',
      userType: 'organization',
    });
    const context = executionContext('Bearer token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.verifyJWT).toHaveBeenCalledWith('token');
    expect(context.request.organizationId).toBe('org-1');
  });

  it('rejects a customer token', async () => {
    authService.verifyJWT.mockResolvedValue({
      sub: 'cust-1',
      userType: 'customer',
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
