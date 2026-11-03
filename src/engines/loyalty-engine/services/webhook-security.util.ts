import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

const SECRET_PREFIX = 'enc:v1:';

export function assertSafeWebhookUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CommonException('Invalid webhook URL', StatusCodes.BAD_REQUEST);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new CommonException(
      'Webhook URL must use http or https',
      StatusCodes.BAD_REQUEST,
    );
  }

  if (process.env.ALLOW_PRIVATE_WEBHOOKS === 'true') return;

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const isPrivate =
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

  if (isPrivate) {
    throw new CommonException(
      'Webhook URL must resolve to a public address',
      StatusCodes.BAD_REQUEST,
    );
  }
}

function encryptionKey(): Buffer | null {
  const raw =
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY ?? process.env.JWT_SECRET;
  if (!raw) return null;
  return createHash('sha256').update(raw).digest();
}

export function encryptWebhookSecret(secret: string): string {
  const key = encryptionKey();
  if (!key) return secret;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${SECRET_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString(
    'base64',
  )}`;
}

export function decryptWebhookSecret(stored: string): string {
  if (!stored.startsWith(SECRET_PREFIX)) return stored;

  const key = encryptionKey();
  if (!key) {
    throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY is not configured');
  }

  const payload = Buffer.from(stored.slice(SECRET_PREFIX.length), 'base64');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
