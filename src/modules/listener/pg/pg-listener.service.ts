import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Client } from 'pg';
import { ConfigService } from '@nestjs/config';
import {
  AutoTopupPayload,
  EventHandler,
  EventPayloadMap,
  ExpiryReminderPayload,
  PGEventsEnum,
} from './events.dto';
import { CampaignJobProducer } from 'src/modules/domain/campaign/jobs/producer';
import { CurrencyService } from 'src/modules/domain/currency/currency.service';

@Injectable()
export class PGListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PGListenerService.name);
  private client: Client;
  private eventHandlers: Map<PGEventsEnum, EventHandler<any>> = new Map();

  private generateLockId(eventName: string, payload: any): bigint {
    let uniqueKey: string;
    if (eventName === PGEventsEnum.auto_topup) {
      uniqueKey = eventName + '_' + payload.currencyBucketId;
    } else if (eventName === PGEventsEnum.handle_expiry_reminders_agenda_job) {
      uniqueKey = eventName + '_' + payload.campaignId;
    } else {
      // Fallback for safety, though all current events are covered
      uniqueKey = eventName + '_' + JSON.stringify(payload);
    }
    const hash = crypto.createHash('sha256').update(uniqueKey).digest();
    // Use the first 8 bytes of the hash for a 64-bit integer (BigInt)
    // Node.js Buffer to BigInt conversion for the first 8 bytes (64 bits)
    let lockIdBigInt = BigInt(0);
    for (let i = 0; i < 8; i++) {
      lockIdBigInt = (lockIdBigInt << BigInt(8)) + BigInt(hash[i]);
    }
    return lockIdBigInt;
  }

  constructor(
    private configService: ConfigService,
    private readonly currencyService: CurrencyService,
    private readonly campaignJobProducer: CampaignJobProducer,
  ) {
    // Set up queue routing
    // Register event handlers
    this.registerEventHandlers();
  }

  async addOrUpdateCampaignExpiryReminderJob(
    event: EventPayloadMap[PGEventsEnum.handle_expiry_reminders_agenda_job],
  ) {
    if (event.isSoftDeleted) {
      await this.campaignJobProducer.deleteCampaignExpiryReminder(
        event.campaignId,
      );
      this.logger.log(
        `Deleted notification jobs for campaign ${event.campaignId} because it was soft deleted`,
      );
      return;
    }

    // Parse endDate from event
    const endDate = new Date(event.endDate);

    // Schedule all the notification jobs
    const results = await this.campaignJobProducer.addCampaignExpiryReminder(
      event.campaignId,
      endDate,
    );

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `Scheduled ${successCount} notification jobs for campaign ${event.campaignId}`,
    );
  }

  async handleAutoTopupEvent(event: EventPayloadMap[PGEventsEnum.auto_topup]) {
    this.currencyService.autoTopUpCurrencyBucket(
      event.currencyBucketId,
      event.organizationId,
      event.amountToAdd,
    );
  }

  private registerEventHandlers() {
    // Handler for auto_topup event
    this.eventHandlers.set(
      PGEventsEnum.auto_topup,
      async (payload: AutoTopupPayload) => {
        // const queue = this.eventToRabbitMQueueMap.get(PGEventsEnum.auto_topup);
        // await this.rabbitMQProducer.publish(
        //   queue,
        //   PGEventsEnum.auto_topup,
        //   payload,
        // );

        // Process event directly
        this.logger.log(
          `Processing event: ${
            PGEventsEnum.auto_topup
          } with payload: ${JSON.stringify(payload)}`,
        );
        this.handleAutoTopupEvent(payload);
        // Actual business logic would go here
      },
    );

    // Handler for handle_expiry_reminders_agenda_job event
    this.eventHandlers.set(
      PGEventsEnum.handle_expiry_reminders_agenda_job,
      async (payload: ExpiryReminderPayload) => {
        // const queue = this.eventToRabbitMQueueMap.get(
        //   PGEventsEnum.handle_expiry_reminders_agenda_job,
        // );
        // await this.rabbitMQProducer.publish(
        //   queue,
        //   PGEventsEnum.handle_expiry_reminders_agenda_job,
        //   payload,
        // );

        // Process event directly
        this.logger.log(
          `Processing event: ${
            PGEventsEnum.handle_expiry_reminders_agenda_job
          } with payload: ${JSON.stringify(payload)}`,
        );

        await this.addOrUpdateCampaignExpiryReminderJob(payload);
        // Actual business logic would go here
      },
    );
  }

  async onModuleInit() {
    try {
      this.client = new Client({
        connectionString: this.configService.get('LSB_PG_URL'),
      });
      await this.client.connect();
      this.client.on('notification', this.handleNotification.bind(this));

      // Listen to all events defined in PGEventsEnum
      for (const event of Object.values(PGEventsEnum)) {
        await this.client.query(`LISTEN ${event}`);
        this.logger.log(`Listening to PostgreSQL notification event: ${event}`);
      }

      this.logger.log('Connected to PostgreSQL notification channels');
    } catch (error) {
      this.logger.error('Error connecting to PostgreSQL:', error);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.end();
    }
  }

  private async handleNotification(msg: any) {
    const { channel: eventName, payload: rawPayload } = msg;
    const event = eventName as PGEventsEnum;

    try {
      const parsedPayload = JSON.parse(rawPayload);
      const handler = this.eventHandlers.get(event);

      if (handler) {
        const lockId = this.generateLockId(event, parsedPayload);
        const result = await this.client.query(
          'SELECT pg_try_advisory_lock($1)',
          [lockId.toString()],
        );

        if (result.rows[0].pg_try_advisory_lock) {
          this.logger.log(
            `Lock acquired for event: ${event} with lock ID: ${lockId}. Processing...`,
          );
          try {
            this.logger.log(`Processing notification for event: ${event}`);
            await handler(parsedPayload);
          } finally {
            await this.client.query('SELECT pg_advisory_unlock($1)', [
              lockId.toString(),
            ]);
            this.logger.log(
              `Lock released for event: ${event} with lock ID: ${lockId}.`,
            );
          }
        } else {
          this.logger.log(
            `Could not acquire lock for event: ${event} with lock ID: ${lockId}. Another instance is likely processing it.`,
          );
        }
      } else {
        this.logger.warn(`No handler registered for event: ${event}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling notification for event ${event}:`,
        error,
      );
    }
  }
}
