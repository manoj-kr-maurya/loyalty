import { Injectable } from '@nestjs/common';
import { CustomerWalletPocketTransactionStatus } from '@prisma/client';
import { JobSchedulerService } from 'src/modules/jobs/job-scheduler.service';
import { handleReversalTransactionJobData } from '../DTO/customerWallets.dto';
import { LongListEnumOfAgendaJobs } from 'src/common/enums/jobs';

@Injectable()
export class CustomerWalletJobProducer {
  constructor(private readonly jobSchedulerService: JobSchedulerService) {}

  async scheduleReversalJob(
    data: handleReversalTransactionJobData,
  ): Promise<void> {
    const jobMapping = {
      [CustomerWalletPocketTransactionStatus.CREDITED]:
        LongListEnumOfAgendaJobs.HANDLE_FULFILL_POINTS_EXPIRY,
      [CustomerWalletPocketTransactionStatus.BLOCKED]:
        LongListEnumOfAgendaJobs.HANDLE_BLOCK_POINTS_UNBLOCKING,
    };

    const jobName = jobMapping[data.status];
    if (!jobName) {
      throw new Error(`Invalid transaction status: ${data.status}`);
    }

    const uniqueJobId = `${jobName}_${data.transactionRef}`;
    this.jobSchedulerService.scheduleJob({
      name: jobName,
      data,
      uniqueJobId,
      when: data.reversalTime,
    });
  }
}
