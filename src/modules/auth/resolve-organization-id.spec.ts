import { resolveOrganizationId } from './resolve-organization-id';

const errorPayload = (callback: () => unknown) => {
  try {
    callback();
  } catch (error) {
    return (error as any).getResponse();
  }
  throw new Error('Expected callback to throw');
};

describe('resolveOrganizationId', () => {
  it('returns the key tenant and ignores matching input', () => {
    expect(
      resolveOrganizationId(
        { type: 'organization', organizationId: 'org-1', scopes: [] },
        'org-1',
      ),
    ).toBe('org-1');
  });

  it('rejects cross-tenant access from an organization key', () => {
    expect(
      errorPayload(() =>
        resolveOrganizationId(
          { type: 'organization', organizationId: 'org-1', scopes: [] },
          'org-2',
        ),
      ),
    ).toMatchObject({
      error: 'API key does not grant access to this organization',
    });
  });

  it('requires an explicit tenant for platform keys', () => {
    expect(
      errorPayload(() =>
        resolveOrganizationId({ type: 'platform', scopes: ['*'] }),
      ),
    ).toMatchObject({
      error: 'organizationId is required when using a platform key',
    });
  });

  it('lets platform keys act on an explicit tenant', () => {
    expect(
      resolveOrganizationId({ type: 'platform', scopes: ['*'] }, 'org-2'),
    ).toBe('org-2');
  });

  it('rejects a missing auth context', () => {
    expect(
      errorPayload(() => resolveOrganizationId(undefined, 'org-1')),
    ).toMatchObject({ error: 'Authentication context is missing' });
  });
});
