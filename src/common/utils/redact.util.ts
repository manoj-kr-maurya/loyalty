export function withoutToken<T>(entity: T): T {
  if (!entity || typeof entity !== 'object') return entity;
  const safe: Record<string, unknown> = {
    ...(entity as Record<string, unknown>),
  };
  delete safe.token;
  return safe as T;
}
