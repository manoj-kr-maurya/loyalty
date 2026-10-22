import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  JobSchedulerService,
  SchedulerJob,
} from 'src/modules/jobs/job-scheduler.service';
import { OrganizationService } from '../organization.service';
import { handleAddNewCurrencyBucketToOrgJobData } from 'src/modules/currency/DTO/currency.dto';
import { LongListEnumOfAgendaJobs } from 'src/common/enums/jobs';

@Injectable()
export class OrganizationJobConsumer implements OnModuleInit {
  private readonly logger = new Logger(OrganizationJobConsumer.name);

  constructor(
    private readonly jobSchedulerService: JobSchedulerService,
    private readonly organizationService: OrganizationService,
  ) {}

  async onModuleInit() {
    await this.defineJobs();
  }

  private async defineJobs() {
    this.jobSchedulerService.defineJob({
      name: LongListEnumOfAgendaJobs.ADD_NEW_CURRENCY_BUCKET_TO_ORG,
      processor: async (job: SchedulerJob) => {
        const data = job.attrs.data as handleAddNewCurrencyBucketToOrgJobData;
        try {
          await this.organizationService.initNewCurrency(
            data.currencyBucket,
            data.organizationId,
          );
        } catch (error) {
          this.logger.error(
            `Failed to add currency bucket ${data.currencyBucket.code} to organization ${data.organizationId}`,
            error.stack,
          );
          throw error; // Agenda will handle retry if needed
        }
      },
      options: {
        priority: 'high',
        concurrency: 5,
        lockLifetime: 30000, // 30 seconds
      },
    });
  }
}
