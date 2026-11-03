import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss from 'pg-boss';
import { envEnums } from 'src/config/enums';

/**
 * The job object shape handed to job processors. Kept structurally compatible
 * with the legacy MongoDB-backed agenda jobs (`job.attrs.data`), so existing
 * consumers continue to work unchanged.
 */
export interface SchedulerJob {
  attrs: {
    _id: string | null;
    name: string;
    data: Record<string, any>;
  };
}

export type JobPriority =
  | 'highest'
  | 'high'
  | 'normal'
  | 'low'
  | 'lowest'
  | number;

interface JobDefinitionOptions {
  concurrency?: number;
  lockLifetime?: number;
  priority?: JobPriority;
}

interface DefineJobParams {
  name: string;
  processor: (job: SchedulerJob) => Promise<void>;
  options?: JobDefinitionOptions;
}

interface ScheduleJobParams {
  name: string;
  data: Record<string, any>;
  uniqueJobId?: string;
  when?: Date | string;
}

interface RecurringJobParams {
  name: string;
  data: Record<string, any>;
  interval: string;
  options?: {
    timezone?: string;
    skipImmediate?: boolean;
    unique?: Record<string, any>;
  };
}

interface CancelJobsParams {
  query: Record<string, any>;
}

export interface JobResult {
  success: boolean;
  job?: SchedulerJob;
  error?: Error;
}

interface CancelResult {
  success: boolean;
  count: number;
  error?: Error;
}

interface StopResult {
  success: boolean;
  error?: Error;
}

/** pg-boss states a cancel/reschedule may still act on (created/retry/active). */
const ACTIONABLE_STATES = "('created','retry','active')";

/**
 * PostgreSQL-backed job scheduler. Replaces the MongoDB-backed Agenda setup
 * (`src/modules/agenda`): jobs live in the same PostgreSQL database under the
 * `pgboss` schema and are processed by in-process workers. The public surface
 * mirrors the old AgendaService (`defineJob`, `scheduleJob`, `cancelJobs`,
 * `updateJobNextRunAt`) so producers/consumers only had their imports changed.
 */
@Injectable()
export class JobSchedulerService implements OnModuleInit {
  private boss: PgBoss;
  private readonly logger = new Logger(JobSchedulerService.name);
  private initialized: Promise<void>;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.initialized = this.initialize();
    await this.initialized;
  }

  private async initialize(): Promise<void> {
    try {
      const connectionString = this.configService.get<string>(
        envEnums.LSB_PG_URL,
      );
      this.boss = new PgBoss({ connectionString });
      await this.boss.start();
      this.logger.log(
        'JobScheduler (pg-boss over PostgreSQL) started successfully',
      );
    } catch (error) {
      this.logger.error('Failed to initialize job scheduler', error.stack);
      throw error;
    }
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retries = 3,
    delayMs = 1000,
  ): Promise<T> {
    let attempt = 1;
    this.logger.debug(
      `Starting operation: ${operationName} with ${retries} retries.`,
    );

    const executeOperation = async (): Promise<T> => {
      try {
        this.logger.debug(`Attempt ${attempt} for ${operationName} started.`);
        const result = await operation();
        this.logger.debug(`Attempt ${attempt} for ${operationName} succeeded.`);
        return result;
      } catch (error) {
        this.logger.warn(
          `Attempt ${attempt}/${retries} failed for ${operationName}`,
          error.stack,
        );
        if (attempt >= retries) {
          this.logger.error(
            `All ${retries} attempts failed for ${operationName}.`,
            error.stack,
          );
          throw error;
        }
        attempt++;
        this.logger.debug(
          `Retrying ${operationName} after ${delayMs * attempt}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        return executeOperation();
      }
    };

    return executeOperation();
  }

  private async executeSql(
    text: string,
    values: unknown[] = [],
  ): Promise<{ rows: any[] }> {
    await this.initialized;
    return this.withRetry(
      () => this.boss.getDb().executeSql(text, values),
      'executeSql',
      3,
      1000,
    );
  }

  /**
   * Register the queue with pg-boss (idempotent `create_queue`), otherwise
   * send() would silently no-op: the insert joins `pgboss.queue` and drops
   * rows for unknown queue names.
   */
  private async ensureQueue(name: string): Promise<void> {
    await this.initialized;
    await this.withRetry(
      () => this.boss.createQueue(name),
      `ensureQueue-${name}`,
      3,
      1000,
    );
  }

  /**
   * Register a named job processor. A pg-boss worker starts polling the queue
   * `name`; each fetched job is wrapped into the `SchedulerJob` shape before
   * being handed to the processor (array is length 1 because `batchSize: 1`).
   */
  async defineJob({ name, processor, options }: DefineJobParams): Promise<void> {
    await this.initialized;
    this.logger.debug(`Defining job: ${name}`);

    const concurrency =
      typeof options?.concurrency === 'number' && options.concurrency > 0
        ? options.concurrency
        : 1;

    try {
      await this.ensureQueue(name);
      await this.withRetry(async () => {
        for (let worker = 0; worker < concurrency; worker++) {
          await this.boss.work(
            name,
            {
              batchSize: 1,
              pollingIntervalSeconds: 3,
            },
            async (jobs) => {
              for (const job of jobs) {
                const schedulerJob: SchedulerJob = {
                  attrs: {
                    _id: job.id,
                    name: job.name,
                    data: (job.data ?? {}) as Record<string, any>,
                  },
                };
                await processor(schedulerJob);
              }
            },
          );
        }
      }, `defineJob-${name}`);

      this.logger.log(`Job ${name} defined successfully`);
    } catch (error) {
      this.logger.error(`Failed to define job ${name}`, error.stack);
      throw error;
    }
  }

  /**
   * Persist a job so it runs once. Passing a `uniqueJobId` makes the job a
   * singleton: pg-boss reuses an existing queued/active job with the same key
   * instead of creating a duplicate (mirrors agenda `job.unique(...)`).
   */
  async scheduleJob({
    name,
    data,
    uniqueJobId,
    when,
  }: ScheduleJobParams): Promise<JobResult> {
    this.logger.debug(
      `Scheduling job: ${name} with data: ${JSON.stringify(data)}`,
    );

    try {
      await this.initialized;
      await this.ensureQueue(name);
      return await this.withRetry(
        async () => {
          const startAfter: Date | undefined =
            !when || when === 'now' ? undefined : new Date(when);

          const id = await this.boss.send(name, data ?? {}, {
            startAfter,
            singletonKey: uniqueJobId ? `${name}|${uniqueJobId}` : undefined,
            retryLimit: 3,
            retryBackoff: true,
          });

          this.logger.log(`Job ${name} scheduled successfully`);
          return {
            success: true,
            job: { attrs: { _id: id, name, data: data ?? {} } },
          };
        },
        `scheduleJob-${name}`,
        3,
        1000,
      );
    } catch (error) {
      this.logger.error(`Failed to schedule job ${name}`, error.stack);
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Register a recurring job using a cron expression (pg-boss `schedule`).
   */
  async createRecurringJob({
    name,
    data,
    interval,
    options,
  }: RecurringJobParams): Promise<JobResult> {
    try {
      await this.initialized;
      await this.ensureQueue(name);
      await this.boss.schedule(name, interval, data ?? {}, {
        tz: options?.timezone,
      });
      this.logger.log(`Recurring job ${name} created successfully`);
      return {
        success: true,
        job: { attrs: { _id: name, name, data: data ?? {} } },
      };
    } catch (error) {
      this.logger.error(`Failed to create recurring job ${name}`, error.stack);
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Cancel actionable jobs matching a query. Supports the query shapes the
   * legacy producers used:
   *   - `{ name }`                                  -> cancel all of a queue
   *   - `{ _id }`                                   -> cancel by job id
   *   - `{ name, 'data.<field>': value }`           -> cancel by queue + payload
   */
  async cancelJobs({ query }: CancelJobsParams): Promise<CancelResult> {
    try {
      await this.initialized;
      const count = await this.withRetry(async () => {
        const { whereClause, params } = this.buildWhereClause(query);
        const result = await this.executeSql(
          `UPDATE pgboss.job
             SET state = 'cancelled', completed_on = now()
             WHERE ${whereClause} AND state IN ${ACTIONABLE_STATES}
             RETURNING id`,
          params,
        );
        return result.rows.length;
      }, `cancelJobs-${JSON.stringify(query)}`);

      this.logger.log(`Cancelled ${count} jobs matching query`);
      return { success: true, count };
    } catch (error) {
      this.logger.error('Failed to cancel jobs', error.stack);
      return {
        success: false,
        count: 0,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Move a pending/queued job to a new run time.
   */
  async updateJobNextRunAt(
    jobId: string,
    nextRunAt: Date | string,
  ): Promise<JobResult> {
    this.logger.debug(
      `Updating job next run time for ID: ${jobId} to ${nextRunAt}`,
    );

    try {
      await this.initialized;
      return await this.withRetry(async () => {
        const result = await this.executeSql(
          `UPDATE pgboss.job
             SET start_after = $2, completed_on = NULL, started_on = NULL, output = NULL
             WHERE id = $1 AND state IN ${ACTIONABLE_STATES}
             RETURNING id, name`,
          [jobId, new Date(nextRunAt)],
        );

        if (result.rows.length === 0) {
          throw new Error(`Job with ID ${jobId} not found`);
        }

        this.logger.log(`Job ${jobId} rescheduled to ${nextRunAt} successfully`);
        return {
          success: true,
          job: {
            attrs: { _id: result.rows[0].id, name: result.rows[0].name, data: {} },
          },
        };
      }, `updateJobNextRunAt-${jobId}`);
    } catch (error) {
      this.logger.error(`Failed to update job ${jobId}`, error.stack);
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  async stop(): Promise<StopResult> {
    try {
      await this.initialized;
      await this.withRetry(
        () => this.boss.stop({ graceful: true, timeout: 10000 }),
        'stopScheduler',
        3,
        1000,
      );
      this.logger.log('JobScheduler stopped successfully');
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to stop job scheduler', error.stack);
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Translate a legacy agenda-style query into a parameterised WHERE clause
   * over `pgboss.job`. Supports `name`, `_id` and dot-key payload filters
   * (`data.<field>`).
   */
  private buildWhereClause(query: Record<string, any>): {
    whereClause: string;
    params: unknown[];
  } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let index = 1;

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue;
      }
      if (key === '_id') {
        conditions.push(`id = $${index++}`);
        params.push(value);
      } else if (key === 'name') {
        conditions.push(`name = $${index++}`);
        params.push(value);
      } else if (key.startsWith('data.')) {
        const field = key.slice('data.'.length);
        conditions.push(`data->>$${index++} = $${index++}`);
        params.push(field, String(value));
      } else {
        this.logger.warn(
          `Unsupported cancelJobs query key: ${key} (ignored)`,
        );
      }
    }

    if (conditions.length === 0) {
      throw new Error('cancelJobs requires at least one filter');
    }

    return { whereClause: conditions.join(' AND '), params };
  }
}