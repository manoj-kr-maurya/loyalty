import { UnauthorizedException } from '@nestjs/common';
import { OrganizationApiKeyGuard } from './organization-api-key.guard';

const executionContext = (headers: Record<string, any>) => {
  const request: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    request,
  } as any;
};

describe('OrganizationApiKeyGuard', () => {
  const platformKey = 'platform-secret';

  let configService: any;
  let apiKeyService: any;
  let guard: OrganizationApiKeyGuard;

  beforeEach(() => {
    configService = { get: jest.fn().mockReturnValue(platformKey) };
    apiKeyService = { validate: jest.fn() };
    guard = new OrganizationApiKeyGuard(configService, apiKeyService);
  });

  it('accepts the platform key and marks it as platform', async () => {
    const context = executionContext({ 'x-api-key': platformKey });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.request.organizationAuth).toEqual({
      type: 'platform',
      scopes: ['*'],
    });
    expect(apiKeyService.validate).not.toHaveBeenCalled();
  });

  it('accepts a valid organization key and attaches its context', async () => {
    const auth = {
      type: 'organization',
      organizationId: 'org-1',
      apiKeyId: 'key-1',
      scopes: ['loyalty:read'],
    };
    apiKeyService.validate.mockResolvedValue(auth);
    const context = executionContext({ 'x-api-key': 'loy_prefix_secret' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.request.organizationAuth).toEqual(auth);
  });

  it('rejects a missing key', async () => {
    await expect(
      guard.canActivate(executionContext({})),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid organization key', async () => {
    apiKeyService.validate.mockResolvedValue(null);

    await expect(
      guard.canActivate(executionContext({ 'x-api-key': 'nope' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
