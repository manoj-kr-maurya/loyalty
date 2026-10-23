import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface OutboxEventInput {
  organizationId: string;
  eventType: string;
  aggregateId: string;
  payload: Record<string, any>;
}

/**
 * Writes domain events to the transactional outbox. Callers pass the same
 * `Prisma.TransactionClient` used for the wallet/ledger writes so the event is
 * committed atomically with the state change it describes.
 */
@Injectable()
export class OutboxService {
  async enqueue(
    tx: Prisma.TransactionClient,
    input: OutboxEventInput,
  ): Promise<string> {
    const event = await tx.loyaltyOutboxEvent.create({
      data: {
        organizationId: input.organizationId,
        eventType: input.eventType,
        aggregateId: input.aggregateId,
        payload: JSON.parse(
          JSON.stringify(input.payload),
        ) as Prisma.InputJsonValue,
      },
    });

    return event.id;
  }
}
