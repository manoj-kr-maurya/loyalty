import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Prisma } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/common/services/prismaService';
import { LongListEnumOfAgendaJobs } from 'src/common/enums/jobs';
import { JobSchedulerService } from 'src/modules/jobs/job-scheduler.service';
import {
  computeRetryDelaySeconds,
  shouldExhaust,
  signWebhookPayload,
} from './webhook-signature';
import {
  assertSafeWebhookUrl,
  decryptWebhookSecret,
} from './webhook-security.util';

interface OutboxRow {
  id: string;
  organizationId: string;
  eventType: string;
  aggregateId: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
}

interface DispatchSummary {
  fannedOut: number;
  delivered: number;
  retried: number;
  exhausted: number;
}

const OUTBOX_BATCH_SIZE = 50;
const DELIVERY_BATCH_SIZE = 20;
const STALE_PROCESSING_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BODY = 2000;
const MAX_ERROR_LENGTH = 1000;

@Injectable()
export class WebhookDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly scheduler: JobSchedulerService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.scheduler.defineJob({
      name: LongListEnumOfAgendaJobs.LOYALTY_WEBHOOK_DISPATCH,
      processor: async () => {
        await this.dispatch();
      },
      options: { concurrency: 1 },
    });

    await this.scheduler.createRecurringJob({
      name: LongListEnumOfAgendaJobs.LOYALTY_WEBHOOK_DISPATCH,
      data: {},
      interval: '*/1 * * * *',
    });
  }

  /**
   * One pass of the outbox pattern:
   *   1. Turn unpublished outbox rows into per-endpoint delivery rows.
   *   2. Attempt every delivery that is due, with exponential backoff.
   */
  async dispatch(): Promise<DispatchSummary> {
    const summary: DispatchSummary = {
      fannedOut: 0,
      delivered: 0,
      retried: 0,
      exhausted: 0,
    };

    try {
      summary.fannedOut = await this.fanOutOutbox();
    } catch (error) {
      this.logger.error(`Outbox fan-out failed: ${this.describe(error)}`);
    }

    try {
      const result = await this.deliverDue();
      summary.delivered = result.delivered;
      summary.retried = result.retried;
      summary.exhausted = result.exhausted;
    } catch (error) {
      this.logger.error(`Webhook delivery failed: ${this.describe(error)}`);
    }

    if (summary.fannedOut || summary.delivered || summary.retried) {
      this.logger.log(
        `Webhook dispatch: fannedOut=${summary.fannedOut} delivered=${summary.delivered} retried=${summary.retried} exhausted=${summary.exhausted}`,
      );
    }

    return summary;
  }

  private async fanOutOutbox(): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const events = await tx.$queryRaw<OutboxRow[]>`
        SELECT "id", "organizationId", "eventType", "aggregateId", "payload", "createdAt"
        FROM "loyaltyOutboxEvent"
        WHERE "publishedAt" IS NULL
        ORDER BY "createdAt" ASC
        LIMIT ${OUTBOX_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      `;

      if (events.length === 0) return 0;

      const now = new Date();
      let created = 0;

      for (const event of events) {
        const endpoints = await tx.loyaltyWebhookEndpoint.findMany({
          where: {
            organizationId: event.organizationId,
            isActive: true,
            OR: [
              { events: { isEmpty: true } },
              { events: { has: '*' } },
              { events: { has: event.eventType } },
            ],
          },
          select: { id: true },
        });

        if (endpoints.length > 0) {
          const envelope = {
            id: event.id,
            type: event.eventType,
            organizationId: event.organizationId,
            aggregateId: event.aggregateId,
            createdAt: event.createdAt.toISOString(),
            data: event.payload,
          };

          const result = await tx.loyaltyWebhookDelivery.createMany({
            data: endpoints.map((endpoint) => ({
              endpointId: endpoint.id,
              outboxEventId: event.id,
              organizationId: event.organizationId,
              eventType: event.eventType,
              payload: envelope as Prisma.InputJsonValue,
            })),
            skipDuplicates: true,
          });
          created += result.count;
        }
      }

      await tx.loyaltyOutboxEvent.updateMany({
        where: { id: { in: events.map((event) => event.id) } },
        data: { publishedAt: now },
      });

      return created;
    });
  }

  private async deliverDue() {
    await this.prisma.loyaltyWebhookDelivery.updateMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) },
      },
      data: { status: 'PENDING' },
    });

    const due = await this.prisma.loyaltyWebhookDelivery.findMany({
      where: {
        status: 'PENDING',
        nextAttemptAt: { lte: new Date() },
      },
      include: { endpoint: true },
      orderBy: { nextAttemptAt: 'asc' },
      take: DELIVERY_BATCH_SIZE,
    });

    const result = { delivered: 0, retried: 0, exhausted: 0 };

    for (const delivery of due) {
      const claimed = await this.prisma.loyaltyWebhookDelivery.updateMany({
        where: { id: delivery.id, status: 'PENDING' },
        data: { status: 'PROCESSING' },
      });
      if (claimed.count === 0) continue;

      if (!delivery.endpoint.isActive) {
        await this.prisma.loyaltyWebhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'EXHAUSTED',
            attempts: { increment: 1 },
            lastError: 'Webhook endpoint is disabled',
          },
        });
        result.exhausted += 1;
        continue;
      }

      const attempt = delivery.attempts + 1;

      try {
        const response = await this.post(delivery.endpoint, delivery);

        await this.prisma.loyaltyWebhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'SUCCESS',
            attempts: attempt,
            deliveredAt: new Date(),
            responseStatus: response.status,
            responseBody: this.truncate(
              this.stringify(response.body),
              MAX_RESPONSE_BODY,
            ),
            lastError: null,
          },
        });
        result.delivered += 1;
      } catch (error) {
        const exhausted = shouldExhaust(attempt, delivery.maxAttempts);
        const delaySeconds = computeRetryDelaySeconds(attempt);

        await this.prisma.loyaltyWebhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: exhausted ? 'EXHAUSTED' : 'PENDING',
            attempts: attempt,
            nextAttemptAt: exhausted
              ? delivery.nextAttemptAt
              : new Date(Date.now() + delaySeconds * 1000),
            responseStatus: error.responseStatus ?? null,
            responseBody: this.truncate(error.responseBody, MAX_RESPONSE_BODY),
            lastError: this.truncate(error.message, MAX_ERROR_LENGTH),
          },
        });

        if (exhausted) {
          result.exhausted += 1;
          this.logger.warn(
            `Webhook delivery ${delivery.id} exhausted after ${attempt} attempts: ${error.message}`,
          );
        } else {
          result.retried += 1;
        }
      }
    }

    return result;
  }

  private async post(
    endpoint: { url: string; secret: string },
    delivery: { id: string; eventType: string; payload: Prisma.JsonValue },
  ) {
    assertSafeWebhookUrl(endpoint.url);
    const rawBody = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(
      decryptWebhookSecret(endpoint.secret),
      timestamp,
      rawBody,
    );

    const response = await firstValueFrom(
      this.http.post(endpoint.url, rawBody, {
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true,
        headers: {
          'content-type': 'application/json',
          'user-agent': 'JAS-Loyalty-Webhooks/1.0',
          'x-loyalty-event': delivery.eventType,
          'x-loyalty-delivery': delivery.id,
          'x-loyalty-timestamp': String(timestamp),
          'x-loyalty-signature': `sha256=${signature}`,
        },
      }),
    );

    if (response.status < 200 || response.status >= 300) {
      const error = new Error(
        `Endpoint responded with HTTP ${response.status}`,
      ) as Error & {
        responseStatus?: number;
        responseBody?: string;
      };
      error.responseStatus = response.status;
      error.responseBody = this.truncate(
        this.stringify(response.data),
        MAX_RESPONSE_BODY,
      );
      throw error;
    }

    return { status: response.status, body: response.data };
  }

  private stringify(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private truncate(value: string | undefined, max: number): string | null {
    if (!value) return null;
    return value.length > max ? `${value.slice(0, max)}…` : value;
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
