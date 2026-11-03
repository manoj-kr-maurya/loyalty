const SENSITIVE_FIELDS = ['token', 'passwordHash'] as const;

/**
 * Returns a shallow copy of an entity that is safe to send to a client:
 * session tokens and credential hashes are removed.
 */
export function redactSecrets<T>(entity: T): T {
  if (!entity || typeof entity !== 'object') return entity;
  const safe: Record<string, unknown> = {
    ...(entity as Record<string, unknown>),
  };
  for (const field of SENSITIVE_FIELDS) {
    delete safe[field];
  }
  return safe as T;
}
