import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  it('produces a salted hash that is not the plain password', async () => {
    const hash = await hashPassword('a-strong-password');

    expect(hash).not.toContain('a-strong-password');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash.split('$')).toHaveLength(6);
  });

  it('produces a different hash every time for the same password', async () => {
    const first = await hashPassword('a-strong-password');
    const second = await hashPassword('a-strong-password');

    expect(first).not.toBe(second);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('a-strong-password');

    await expect(verifyPassword('a-strong-password', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('a-strong-password');

    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('rejects malformed hashes instead of throwing', async () => {
    await expect(verifyPassword('a-strong-password', '')).resolves.toBe(false);
    await expect(verifyPassword('a-strong-password', 'nonsense')).resolves.toBe(
      false,
    );
    await expect(
      verifyPassword('a-strong-password', 'bcrypt$1$2$3$4$5'),
    ).resolves.toBe(false);
  });
});
