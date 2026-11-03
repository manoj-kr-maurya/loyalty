import { Injectable } from '@nestjs/common';
import { LongListEnumOfAgendaJobs } from 'src/common/enums/jobs';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { JobSchedulerService } from 'src/modules/jobs/job-scheduler.service';
import { handleAddNewCurrencyBucketToOrgJobData } from '../DTO/currency.dto';

interface JobResult {
  success: boolean;
  jobId?: string;
  error?: Error;
}

@Injectable()
export class CurrencyJobProducer {
  constructor(
    private readonly jobSchedulerService: JobSchedulerService,
    private readonly commonUtilService: CommonUtilsService,
  ) {}

  private async scheduleJob({
    jobType,
    data,
    idSuffix,
  }: {
    jobType: string;
    data: Record<string, any>;
    idSuffix: string;
  }): Promise<JobResult> {
    try {
      const uniqueJobId = this.commonUtilService.generateJobName(
        jobType,
        idSuffix,
      );

      const result = await this.jobSchedulerService.scheduleJob({
        name: jobType,
        data,
        uniqueJobId,
        when: 'now', // Immediate execution
      });

      return {
        success: result.success,
        jobId: result.job?.attrs._id?.toString(),
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error : new Error('Unknown error occurred'),
      };
    }
  }

  async addNewCurrencyBucketToOrg(
    data: handleAddNewCurrencyBucketToOrgJobData,
  ): Promise<JobResult> {
    const uniqueIdSuffix = `${data.organizationId}_${data.currencyBucket.code}`;

    return this.scheduleJob({
      jobType: LongListEnumOfAgendaJobs.ADD_NEW_CURRENCY_BUCKET_TO_ORG,
      data,
      idSuffix: uniqueIdSuffix,
    });
  }

  // Helper method to cancel a job if needed
  async cancelJob(jobId: string): Promise<{ success: boolean; error?: Error }> {
    const result = await this.jobSchedulerService.cancelJobs({
      query: { _id: jobId },
    });

    return {
      success: result.success,
      error: result.error,
    };
  }
}
