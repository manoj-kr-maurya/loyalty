import { OnModuleInit, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agenda, Job } from '@hokify/agenda';
import { createAgendaInstance } from './agenda.config';

type JobPriority = 'highest' | 'high' | 'normal' | 'low' | 'lowest' | number;

interface JobDefinitionOptions {
  concurrency?: number;
  lockLimit?: number;
  lockLifetime?: number;
  priority?: JobPriority;
}

interface DefineJobParams {
  name: string;
  processor: (job: Job) => Promise<void>;
  options?: JobDefinitionOptions;
}

interface ScheduleJobParams {
  name: string;
  data: Record<string, any>;
  uniqueJobId: string;
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

interface JobResult {
  success: boolean;
  job?: Job;
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

@Injectable()
export class AgendaService implements OnModuleInit {
  private agenda: Agenda;
  private readonly logger = new Logger(AgendaService.name);
  private agendaInitialized: Promise<void>;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.agendaInitialized = this.initializeAgenda();
    await this.agendaInitialized;
  }

  private async initializeAgenda(): Promise<void> {
    try {
      this.agenda = await createAgendaInstance(this.configService);
      await this.agenda.start();
      this.logger.log('Agenda started successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Agenda', error.stack);
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

  getAgenda(): Agenda {
    this.logger.debug('Retrieving agenda instance.');
    return this.agenda;
  }

  async defineJob({ name, processor, options }: DefineJobParams) {
    await this.agendaInitialized;
    this.logger.debug(`Defining job: ${name}`);

    try {
      await this.withRetry(async () => {
        this.logger.debug(`Executing job definition for ${name}`);
        this.agenda.define(name, processor, options);
      }, `defineJob-${name}`);

      this.logger.log(`Job ${name} defined successfully`);
    } catch (error) {
      this.logger.error(`Failed to define job ${name}`, error.stack);
      throw error;
    }
  }

  async updateJobNextRunAt(
    jobId: string,
    nextRunAt: Date | string,
  ): Promise<JobResult> {
    this.logger.debug(
      `Updating job next run time for ID: ${jobId} to ${nextRunAt}`,
    );

    try {
      await this.agendaInitialized;
      return await this.withRetry(
        async () => {
          this.logger.debug(`Fetching job with ID: ${jobId}`);
          const jobs = await this.agenda.jobs({ _id: { $oid: jobId } });

          if (!jobs || jobs.length === 0) {
            this.logger.warn(`Job with ID ${jobId} not found.`);
            throw new Error(`Job with ID ${jobId} not found`);
          }

          const job = jobs[0];
          this.logger.debug(
            `Job ${jobId} found. Updating schedule to ${nextRunAt}`,
          );

          job.schedule(nextRunAt);
          await job.save();

          this.logger.log(
            `Job ${jobId} rescheduled to ${nextRunAt} successfully`,
          );
          return { success: true, job };
        },
        `updateJobNextRunAt-${jobId}`,
        3,
        1000,
      );
    } catch (error) {
      this.logger.error(`Failed to update job ${jobId}`, error.stack);
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

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
      await this.agendaInitialized;
      return await this.withRetry(
        async () => {
          this.logger.debug(`Creating job: ${name}`);
          const job = this.agenda.create(name, data);

          // Only set uniqueJobId if you want to prevent duplicates
          // If you want a new job each time:
          // Don't set uniqueJobId at all
          if (uniqueJobId) {
            // Option: Generate a unique ID by combining the base ID with a timestamp
            job.unique({ 'data.uniqueId': uniqueJobId });

            this.logger.debug(
              `Applying uniqueness constraint on job: ${name} with ID: ${uniqueJobId}`,
            );
          }

          if (!when || when === 'now') {
            this.logger.debug(`Scheduling job ${name} to run immediately.`);
            job.attrs.nextRunAt = new Date();
          } else {
            this.logger.debug(`Scheduling job ${name} to run at ${when}.`);
            job.schedule(when);
          }

          await job.save();
          this.logger.log(`Job ${name} scheduled successfully`);

          return { success: true, job };
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

  async createRecurringJob({
    name,
    data,
    interval,
    options,
  }: RecurringJobParams): Promise<JobResult> {
    try {
      await this.agendaInitialized;
      return await this.withRetry(
        async () => {
          const job = this.agenda.create(name, data);
          if (options?.unique) {
            job.unique(options.unique);
          }
          job.repeatEvery(interval, {
            timezone: options?.timezone,
            skipImmediate: options?.skipImmediate,
          });
          await job.save();
          this.logger.log(`Recurring job ${name} created successfully`);
          return { success: true, job };
        },
        `createRecurringJob-${name}`,
        3,
        1000,
      );
    } catch (error) {
      this.logger.error(`Failed to create recurring job ${name}`, error.stack);
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  async cancelJobs({ query }: CancelJobsParams): Promise<CancelResult> {
    try {
      await this.agendaInitialized;
      const count = await this.withRetry(
        () => this.agenda.cancel(query),
        `cancelJobs-${JSON.stringify(query)}`,
        3,
        1000,
      );
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

  async stop(): Promise<StopResult> {
    try {
      await this.agendaInitialized;
      await this.withRetry(() => this.agenda.stop(), 'stopAgenda', 3, 1000);
      this.logger.log('Agenda stopped successfully');
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to stop Agenda', error.stack);
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  async getRunningJobs({ name }: { name?: string }): Promise<JobResult[]> {
    try {
      await this.agendaInitialized;
      return await this.withRetry(
        async () => {
          const query = name
            ? { name, lastRunAt: { $ne: null } }
            : { lastRunAt: { $ne: null } };
          const jobs = await this.agenda.jobs(query);
          return jobs.map((job) => ({
            success: true,
            job,
          }));
        },
        `getRunningJobs-${name || 'all'}`,
        3,
        1000,
      );
    } catch (error) {
      this.logger.error('Failed to get running jobs', error.stack);
      return [
        {
          success: false,
          error: error instanceof Error ? error : new Error('Unknown error'),
        },
      ];
    }
  }

  async findJobs(query: Record<string, any>): Promise<Job[]> {
    try {
      await this.agendaInitialized;
      return await this.withRetry(
        () => this.agenda.jobs(query),
        `findJobs-${JSON.stringify(query)}`,
        3,
        1000,
      );
    } catch (error) {
      this.logger.error('Failed to find jobs', error.stack);
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }
}
