export enum PGEventsEnum {
  auto_topup = 'auto_topup',
  handle_expiry_reminders_agenda_job = 'handle_expiry_reminders_agenda_job',
}

interface BasePgPayload {
  pgEventName: PGEventsEnum;
}

// Type definitions for event payloads
export interface AutoTopupPayload extends BasePgPayload {
  currencyBucketId: string;
  organizationId: string;
  amountToAdd: number;
  fcmToken: string | null;
  autoTopUpThreshold: number;
  currencyCode: string;
  oldAvailableAmount: number;
}

export interface ExpiryReminderPayload extends BasePgPayload {
  campaignId: string;
  organizationId: string;
  endDate: string;
  name: string;
  isSoftDeleted: boolean;
  fcmToken: string | null;
}

// Map event types to their payload types
export type EventPayloadMap = {
  [PGEventsEnum.auto_topup]: AutoTopupPayload;
  [PGEventsEnum.handle_expiry_reminders_agenda_job]: ExpiryReminderPayload;
};

// Handler type that's aware of the payload type based on the event
export type EventHandler<E extends PGEventsEnum> = (
  payload: EventPayloadMap[E],
) => Promise<void>;
