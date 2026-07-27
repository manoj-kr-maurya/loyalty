import { Injectable } from '@nestjs/common';
import { LongListEnumOfAgendaJobs } from 'src/common/enums/jobs';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { AgendaService } from 'src/modules/agenda/agenda.service';
import {
  CustomerBlockPoints,
  CustomerCreditPoints,
  CustomerDebitAfterBlockPoints,
  customerOrganizationOrderCompletingJobData,
  initializePointsJobData,
} from 'src/modules/domain/customer-wallets/DTO/customerWallets.dto';

interface JobResult {
  success: boolean;
  jobId?: string;
  error?: Error;
}

@Injectable()
export class CustomerOrganizationOrderJobProducer {
  constructor(
    private readonly agendaService: AgendaService,
    private readonly commonUtilsService: CommonUtilsService,
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
      const uniqueJobId = this.commonUtilsService.generateJobName(
        jobType,
        idSuffix,
      );
      const result = await this.agendaService.scheduleJob({
        name: jobType,
        data,
        uniqueJobId,
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

  async addOneStepCreditToPointsJob(
    data: CustomerCreditPoints,
  ): Promise<JobResult> {
    return this.scheduleJob({
      jobType: LongListEnumOfAgendaJobs.HANDLE_ONE_STEP_CREDIT_POINTS,
      data,
      idSuffix: data.transactionRef,
    });
  }

  async addBlockCustomerPointsJob(
    data: CustomerBlockPoints,
  ): Promise<JobResult> {
    return this.scheduleJob({
      jobType: LongListEnumOfAgendaJobs.HANDLE_BLOCKING_CUSTOMER_POINTS,
      data,
      idSuffix: data.transactionRef,
    });
  }

  async addDebitBlockedPointsJob(
    data: CustomerDebitAfterBlockPoints,
  ): Promise<JobResult> {
    return this.scheduleJob({
      jobType: LongListEnumOfAgendaJobs.HANDLE_DEBITING_BLOCKED_POINTS,
      data,
      idSuffix: data.transactionRef,
    });
  }

  async addInititalizeCustomerPointsJob(
    data: initializePointsJobData,
  ): Promise<JobResult> {
    return this.scheduleJob({
      jobType: LongListEnumOfAgendaJobs.INITIALIZE_CUSTOMER_POINTS,
      data,
      idSuffix: `${data.customerId}_${data.currencyCode}`,
    });
  }

  async addHandleCustomerOrganizationOrderCompletingJob(
    data: customerOrganizationOrderCompletingJobData,
  ): Promise<JobResult> {
    return this.scheduleJob({
      jobType:
        LongListEnumOfAgendaJobs.HANDLE_CUSTOMER_ORGANIZATION_ORDER_COMPLETING,
      data,
      idSuffix: `${data.customerId}_${data.transactionRef}`,
    });
  }

  // Optional: Add method to cancel jobs if needed
  async cancelJob(jobId: string): Promise<{ success: boolean; error?: Error }> {
    const result = await this.agendaService.cancelJobs({
      query: { _id: jobId },
    });

    return {
      success: result.success,
      error: result.error,
    };
  }
}
