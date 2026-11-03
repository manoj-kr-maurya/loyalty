import { CommonException } from 'src/common/exceptions/common.exception';
import {
  assertSafeWebhookUrl,
  decryptWebhookSecret,
  encryptWebhookSecret,
} from './webhook-security.util';

describe('webhook security utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects private and loopback webhook destinations by default', () => {
    delete process.env.ALLOW_PRIVATE_WEBHOOKS;

    expect(() => assertSafeWebhookUrl('http://127.0.0.1:3000/hook')).toThrow(
      CommonException,
    );
    expect(() => assertSafeWebhookUrl('http://localhost/hook')).toThrow(
      CommonException,
    );
  });

  it('allows private destinations only when explicitly opted in', () => {
    process.env.ALLOW_PRIVATE_WEBHOOKS = 'true';

    expect(() =>
      assertSafeWebhookUrl('http://127.0.0.1:3000/hook'),
    ).not.toThrow();
  });

  it('rejects non-http protocols', () => {
    expect(() => assertSafeWebhookUrl('file:///etc/passwd')).toThrow(
      CommonException,
    );
  });

  it('encrypts secrets at rest and decrypts them for signing', () => {
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = 'test-encryption-key';

    const stored = encryptWebhookSecret('0123456789abcdef');

    expect(stored).not.toBe('0123456789abcdef');
    expect(stored.startsWith('enc:v1:')).toBe(true);
    expect(decryptWebhookSecret(stored)).toBe('0123456789abcdef');
  });

  it('keeps legacy plaintext secrets readable', () => {
    expect(decryptWebhookSecret('legacy-secret')).toBe('legacy-secret');
  });
});
