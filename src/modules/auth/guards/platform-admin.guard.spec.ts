import { UnauthorizedException } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

const executionContext = (headers: Record<string, any>) => {
  const request: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    request,
  } as any;
};

describe('PlatformAdminGuard', () => {
  const platformKey = 'platform-secret';

  let configService: any;
  let guard: PlatformAdminGuard;

  beforeEach(() => {
    configService = { get: jest.fn().mockReturnValue(platformKey) };
    guard = new PlatformAdminGuard(configService);
  });

  it('accepts the platform key and attaches a platform context', () => {
    const context = executionContext({ 'x-api-key': platformKey });

    expect(guard.canActivate(context)).toBe(true);
    expect(context.request.organizationAuth).toEqual({
      type: 'platform',
      scopes: ['*'],
    });
  });

  it('rejects organization keys', () => {
    expect(() =>
      guard.canActivate(
        executionContext({ 'x-api-key': 'loy_abcdef123456_secret' }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a missing key', () => {
    expect(() => guard.canActivate(executionContext({}))).toThrow(
      UnauthorizedException,
    );
  });
});
