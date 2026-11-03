import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const ALGORITHM = 'scrypt';
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

/**
 * Hashes a password with scrypt and a per-password random salt.
 * The returned string carries the parameters so the cost can be raised later
 * without invalidating hashes that were produced with the previous cost.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
  });

  return [
    ALGORITHM,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString('base64'),
    derivedKey.toString('base64'),
  ].join('$');
}

/**
 * Verifies a password against a stored hash in constant time.
 * Returns false for malformed hashes instead of throwing.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 6) {
    return false;
  }

  const [algorithm, cost, blockSize, parallelization, salt, expectedKey] =
    parts;
  if (algorithm !== ALGORITHM) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedKey, 'base64');
  if (expectedBuffer.length === 0) {
    return false;
  }

  const derivedKey = await scrypt(
    password,
    Buffer.from(salt, 'base64'),
    expectedBuffer.length,
    {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelization),
    },
  );

  return timingSafeEqual(derivedKey, expectedBuffer);
}
