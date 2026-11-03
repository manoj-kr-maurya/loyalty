import { createHmac } from 'crypto';

/**
 * Signs a webhook request using the same scheme consumers can verify:
 *   signature = HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
 * The timestamp is included so receivers can reject replayed requests.
 */
export function signWebhookPayload(
  secret: string,
  timestamp: number,
  rawBody: string,
): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
}

/** Exponential backoff capped at one hour. `attempts` is 1-based. */
export function computeRetryDelaySeconds(attempts: number): number {
  const safeAttempts = Math.max(1, Math.trunc(attempts));
  return Math.min(3600, 15 * 2 ** (safeAttempts - 1));
}

export function shouldExhaust(attempts: number, maxAttempts: number): boolean {
  return attempts >= maxAttempts;
}

/** An empty subscription means "all events"; `*` is also accepted. */
export function matchesEventSubscription(
  events: string[] | null | undefined,
  eventType: string,
): boolean {
  if (!events || events.length === 0) return true;
  return events.includes('*') || events.includes(eventType);
}
