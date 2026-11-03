import { of } from 'rxjs';
import { TenantScopeInterceptor } from './tenant-scope.interceptor';

const executionContext = (request: any) =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as any);

const next = { handle: jest.fn().mockReturnValue(of('ok')) } as any;

const errorPayload = (callback: () => unknown) => {
  try {
    callback();
  } catch (error) {
    return (error as any).getResponse();
  }
  throw new Error('Expected callback to throw');
};

describe('TenantScopeInterceptor', () => {
  let interceptor: TenantScopeInterceptor;

  beforeEach(() => {
    interceptor = new TenantScopeInterceptor();
    next.handle.mockClear();
  });

  it('lets organization keys reference their own tenant', () => {
    const context = executionContext({
      organizationAuth: { type: 'organization', organizationId: 'org-1' },
      params: { organizationId: 'org-1' },
      query: { organizationId: 'org-1' },
      body: { organizationId: 'org-1' },
    });

    expect(interceptor.intercept(context, next)).toBeDefined();
    expect(next.handle).toHaveBeenCalled();
  });

  it('rejects cross-tenant references from an organization key', () => {
    const context = executionContext({
      organizationAuth: { type: 'organization', organizationId: 'org-1' },
      params: {},
      query: { organizationId: 'org-2' },
      body: {},
    });

    expect(
      errorPayload(() => interceptor.intercept(context, next)),
    ).toMatchObject({
      error: 'API key does not grant access to this organization',
    });
  });

  it('rejects cross-tenant tenantId references', () => {
    const context = executionContext({
      organizationAuth: { type: 'organization', organizationId: 'org-1' },
      params: { tenantId: 'org-2' },
      query: {},
      body: {},
    });

    expect(
      errorPayload(() => interceptor.intercept(context, next)),
    ).toMatchObject({
      error: 'API key does not grant access to this organization',
    });
  });

  it('lets platform keys through', () => {
    const context = executionContext({
      organizationAuth: { type: 'platform', scopes: ['*'] },
      params: { organizationId: 'org-2' },
      query: {},
      body: {},
    });

    interceptor.intercept(context, next);

    expect(next.handle).toHaveBeenCalled();
  });

  it('ignores unauthenticated requests', () => {
    const context = executionContext({
      params: {},
      query: { organizationId: 'org-2' },
      body: {},
    });

    interceptor.intercept(context, next);

    expect(next.handle).toHaveBeenCalled();
  });
});
