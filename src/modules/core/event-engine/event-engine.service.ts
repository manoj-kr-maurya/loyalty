import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

export type RewardEventName =
  | 'reward.blocked'
  | 'reward.awarded'
  | 'reward.expired'
  | 'reward.reversed'
  | 'reward.calculated'
  | 'reward.eligibility.evaluated'
  | 'budget.reserved'
  | 'budget.exhausted'
  | 'promo.evaluated'
  | 'promo.conflict.resolved'
  | 'promo.discount.computed'
  | 'promo.coupon.allocated'
  | 'promo.coupon.blocked'
  | 'promo.coupon.released'
  | 'promo.coupon.claimed'
  | 'promo.claim.recorded'
  | 'promo.claim.revoked';

export interface RewardEventPayload {
  programId?: string;
  programName?: string;
  customerId?: string;
  rewardType?: string;
  amount?: number;
  currency?: string;
  blockRef?: string;
  transactionRef?: string;
  meta?: Record<string, any>;
  timestamp?: string;
  [key: string]: any;
}

/**
 * Event Engine — publishes domain events for reward lifecycle.
 * Uses Node.js built-in EventEmitter for in-process pub/sub.
 * Can be extended to use BullMQ / Redis Pub/Sub for distributed systems.
 */
@Injectable()
export class EventEngineService {
  private readonly logger = new Logger(EventEngineService.name);
  private readonly eventEmitter = new EventEmitter();

  /**
   * Subscribe to a specific event or 'reward.*' for all reward events.
   */
  on(eventName: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.on(eventName, listener);
    return this;
  }

  /**
   * Subscribe to an event once.
   */
  once(eventName: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.once(eventName, listener);
    return this;
  }

  /**
   * Remove a listener.
   */
  off(eventName: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.off(eventName, listener);
    return this;
  }

  /**
   * Publish a reward event. Listeners can subscribe to these events
   * for audit logging, notifications, analytics, etc.
   */
  publish(eventName: RewardEventName, payload: RewardEventPayload): void {
    const enrichedPayload: RewardEventPayload = {
      ...payload,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    };

    this.logger.log(
      `[Event] ${eventName} | program=${payload.programId ?? 'N/A'} | customer=${payload.customerId ?? 'N/A'} | amount=${payload.amount ?? 'N/A'}`,
    );

    // Emit both the specific event and a wildcard 'reward.*' for generic listeners
    this.eventEmitter.emit(eventName, enrichedPayload);
    this.eventEmitter.emit('reward.*', { eventName, ...enrichedPayload });
  }

  /**
   * Publish multiple events in batch.
   */
  publishBatch(events: { eventName: RewardEventName; payload: RewardEventPayload }[]): void {
    for (const { eventName, payload } of events) {
      this.publish(eventName, payload);
    }
  }
}
