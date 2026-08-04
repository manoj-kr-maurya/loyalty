import {
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from '@redis/client';
import { envEnums } from 'src/config/enums';

/**
 * Owns the process-wide Redis client lifecycle.
 *
 * Production-readiness guarantees:
 *  - Event handlers are attached BEFORE connect() so an unexpected socket close
 *    (e.g. SocketClosedUnexpectedlyError) is handled and never crashes the app.
 *  - TLS support for managed Redis (Upstash, etc.) via REDIS_TLS.
 *  - Exponential-backoff reconnection for an established connection that drops.
 *  - A background retry loop so a Redis that is down at boot does not leave the
 *    client disconnected forever and does not crash bootstrap.
 *  - Throttled/informative logging instead of unhandled events or log flooding.
 *  - Graceful disconnect on application shutdown.
 */
@Injectable()
export class RedisClientProvider implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisClientProvider.name);
  private readonly client: RedisClientType;
  private connectionAttempts = 0;
  private connecting = false;
  private retryTimer: NodeJS.Timeout | null = null;
  private shutdown = false;

  constructor(private readonly configService: ConfigService) {
    // Coerce config values to their real types. Nest returns env values as
    // strings unless transformed; node-redis fails when `tls` is 'true' (string)
    // instead of boolean true, and treats a numeric-string port inconsistently.
    const host = configService.get<string>(envEnums.REDIS_HOST);
    const port = Number(configService.get<number>(envEnums.REDIS_PORT));
    const rawTls = configService.get<string | boolean>(envEnums.REDIS_TLS);
    const tls = rawTls === true || rawTls === 'true' || rawTls === '1';

    this.client = createClient({
      socket: {
        host,
        port,
        tls,
        reconnectStrategy: (retries) => this.reconnectStrategy(retries),
      },
      username: 'default',
      password: configService.get<string>(envEnums.REDIS_PASSWORD),
    });

    this.attachEventHandlers();
    this.ensureConnected();
  }

  get clientInstance(): RedisClientType {
    return this.client;
  }

  isReady(): boolean {
    return this.client.isReady;
  }

  /**
   * Backoff while Redis is unreachable. Returns the delay (ms) before the next
   * attempt. Once an established connection drops, node-redis drives this; for
   * the initial connection we drive it ourselves via ensureConnected().
   */
  private reconnectStrategy(retries: number): number | Error {
    // Cap the delay so reconnects are not too aggressive yet recover eventually.
    return Math.min(1000 * 2 ** retries, 30000);
  }

  /**
   * Connects (or re-connects) in the background without ever crashing bootstrap.
   * node-redis only auto-reconnects after a connection was previously ready, so
   * an initial boot-time failure is retried here until it succeeds.
   */
  private async ensureConnected(): Promise<void> {
    if (this.connecting || this.shutdown || this.client.isOpen) return;
    this.connecting = true;

    try {
      await this.client.connect();
    } catch (error) {
      this.connecting = false;
      if (this.shutdown) return;
      this.logger.warn(
        `Initial Redis connection failed (${(error as Error).message}); retrying in 2s`,
      );
      if (!this.retryTimer) {
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          this.ensureConnected();
        }, 2000);
      }
      return;
    }

    this.connecting = false;
    this.connectionAttempts = 0;
    this.logger.log('Redis ready');
  }

  private attachEventHandlers(): void {
    this.client.on('error', (error) => {
      this.onConnectionError(error.message);
    });
    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });
    this.client.on('reconnecting', () => {
      this.onReconnecting();
    });
    this.client.on('end', () => {
      this.logger.warn('Redis connection ended');
    });
  }

  private onConnectionError(message: string): void {
    this.connectionAttempts += 1;
    // Log the first few failures, then throttle every 10th to avoid log flooding.
    if (
      this.connectionAttempts <= 3 ||
      this.connectionAttempts % 10 === 0
    ) {
      this.logger.error(`Redis connection error: ${message}`);
    }
  }

  private onReconnecting(): void {
    if (
      this.connectionAttempts <= 3 ||
      this.connectionAttempts % 10 === 0
    ) {
      this.logger.warn(
        `Redis reconnecting (attempt #${this.connectionAttempts})`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.shutdown = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.logger.log('Closing Redis connection');
    if (!this.client.isOpen) {
      try {
        (this.client as any).destroy();
      } catch {
        /* already closed */
      }
      return;
    }
    try {
      await this.client.quit();
    } catch {
      try {
        (this.client as any).destroy();
      } catch {
        /* already closed */
      }
    }
  }
}