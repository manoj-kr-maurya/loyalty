import { createHash } from 'crypto';
import { ApiKeyService, API_KEY_SCOPES } from './api-key.service';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const rejectionPayload = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as any).getResponse();
  }
  throw new Error('Expected promise to reject');
};

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      organization: { findFirst: jest.fn() },
      organizationApiKey: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    service = new ApiKeyService(prisma);
  });

  describe('create', () => {
    it('stores only a hash and returns the plaintext key once', async () => {
      prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      prisma.organizationApiKey.findUnique.mockResolvedValue(null);
      prisma.organizationApiKey.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'key-1', ...data }),
      );

      const result = await service.create({ organizationId: 'org-1' });

      expect(result.key).toMatch(/^loy_[0-9a-f]{12}_[0-9a-f]{64}$/);

      const stored = prisma.organizationApiKey.create.mock.calls[0][0].data;
      expect(stored.keyHash).toBe(sha256(result.key));
      expect(stored.keyHash).not.toBe(result.key);
      expect(stored.scopes).toEqual([...API_KEY_SCOPES]);
    });

    it('rejects unknown scopes', async () => {
      prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' });

      await expect(
        rejectionPayload(
          service.create({
            organizationId: 'org-1',
            scopes: ['loyalty:write', 'billing:admin'],
          }),
        ),
      ).resolves.toMatchObject({
        error: 'Unknown scope(s): billing:admin',
      });
    });

    it('rejects an unknown organization', async () => {
      prisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        rejectionPayload(service.create({ organizationId: 'missing' })),
      ).resolves.toMatchObject({
        error: 'Organization missing not found',
      });
    });
  });

  describe('validate', () => {
    const rawKey = 'loy_abcdef123456_secretsecretsecret';

    const record = (overrides: Record<string, any> = {}) => ({
      id: 'key-1',
      organizationId: 'org-1',
      prefix: 'abcdef123456',
      keyHash: sha256(rawKey),
      scopes: ['loyalty:read'],
      isActive: true,
      revokedAt: null,
      expiresAt: null,
      ...overrides,
    });

    it('returns the organization context for a valid key', async () => {
      prisma.organizationApiKey.findUnique.mockResolvedValue(record());

      const context = await service.validate(rawKey);

      expect(context).toEqual({
        type: 'organization',
        organizationId: 'org-1',
        apiKeyId: 'key-1',
        scopes: ['loyalty:read'],
      });
    });

    it.each([
      ['malformed', 'not-a-key'],
      ['revoked', record({ revokedAt: new Date() })],
      ['inactive', record({ isActive: false })],
      ['expired', record({ expiresAt: new Date('2000-01-01') })],
      ['wrong secret', record({ keyHash: sha256('loy_abcdef123456_other') })],
    ])('returns null for a %s key', async (_label, stored) => {
      prisma.organizationApiKey.findUnique.mockResolvedValue(
        typeof stored === 'string' ? null : stored,
      );

      const value = _label === 'malformed' ? stored : rawKey;
      await expect(service.validate(value as string)).resolves.toBeNull();
    });

    it('returns null when the prefix is unknown', async () => {
      prisma.organizationApiKey.findUnique.mockResolvedValue(null);

      await expect(service.validate(rawKey)).resolves.toBeNull();
    });
  });

  describe('revoke', () => {
    it('marks the key revoked', async () => {
      prisma.organizationApiKey.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.revoke('key-1', 'org-1')).resolves.toEqual({
        id: 'key-1',
        revoked: true,
      });
    });

    it('throws when the key does not belong to the organization', async () => {
      prisma.organizationApiKey.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        rejectionPayload(service.revoke('key-1', 'org-1')),
      ).resolves.toMatchObject({
        error: 'API key key-1 not found',
      });
    });
  });
});
