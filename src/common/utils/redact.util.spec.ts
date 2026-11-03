import { redactSecrets } from './redact.util';

describe('redactSecrets', () => {
  it('removes session tokens and credential hashes', () => {
    const organization = {
      id: 'org-1',
      name: 'Acme',
      token: 'jwt',
      passwordHash: 'scrypt$...',
    };

    const safe = redactSecrets(organization);

    expect(safe).toEqual({ id: 'org-1', name: 'Acme' });
    expect(organization.passwordHash).toBe('scrypt$...');
  });

  it('returns primitives and nullish values unchanged', () => {
    expect(redactSecrets('text')).toBe('text');
    expect(redactSecrets(null)).toBeNull();
    expect(redactSecrets(undefined)).toBeUndefined();
  });
});
