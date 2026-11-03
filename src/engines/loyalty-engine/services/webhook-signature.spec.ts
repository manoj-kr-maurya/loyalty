import {
  computeRetryDelaySeconds,
  matchesEventSubscription,
  shouldExhaust,
  signWebhookPayload,
} from './webhook-signature';

describe('webhook-signature', () => {
  it('produces a stable HMAC for the timestamp and body', () => {
    const signature = signWebhookPayload('secret', 1700000000, '{"a":1}');
    expect(signature).toHaveLength(64);
    expect(signature).toBe(signWebhookPayload('secret', 1700000000, '{"a":1}'));
    expect(signature).not.toBe(
      signWebhookPayload('other-secret', 1700000000, '{"a":1}'),
    );
    expect(signature).not.toBe(
      signWebhookPayload('secret', 1700000001, '{"a":1}'),
    );
  });

  it('backs off exponentially and caps at one hour', () => {
    expect(computeRetryDelaySeconds(1)).toBe(15);
    expect(computeRetryDelaySeconds(2)).toBe(30);
    expect(computeRetryDelaySeconds(4)).toBe(120);
    expect(computeRetryDelaySeconds(20)).toBe(3600);
  });

  it('marks deliveries exhausted once max attempts is reached', () => {
    expect(shouldExhaust(5, 6)).toBe(false);
    expect(shouldExhaust(6, 6)).toBe(true);
    expect(shouldExhaust(7, 6)).toBe(true);
  });

  it('treats empty subscriptions as all events', () => {
    expect(matchesEventSubscription([], 'points.earned')).toBe(true);
    expect(matchesEventSubscription(undefined, 'points.earned')).toBe(true);
    expect(matchesEventSubscription(['*'], 'points.earned')).toBe(true);
    expect(matchesEventSubscription(['points.burned'], 'points.earned')).toBe(
      false,
    );
    expect(matchesEventSubscription(['points.earned'], 'points.earned')).toBe(
      true,
    );
  });
});
