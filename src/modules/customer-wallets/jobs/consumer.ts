import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LongListEnumOfAgendaJobs } from 'src/common/enums/jobs';
import {
  JobSchedulerService,
  SchedulerJob,
} from 'src/modules/jobs/job-scheduler.service';
import { CustomerWalletService } from '../customer-wallets.service';

interface JobProcessorParams {
  customerId: string;
  currencyCode: string;
  transactionRef: string;
  newTransaction?: {
    transactionRef: string;
  };
}

interface JobDefinitionParams {
  name: string;
  handler: (params: JobProcessorParams) => Promise<void>;
  options?: {
    priority?: 'highest' | 'high' | 'normal' | 'low' | 'lowest';
    concurrency?: number;
    lockLifetime?: number;
  };
}

interface BaseJobProcessorParams {
  customerId: string;
  currencyCode: string;
  transactionRef: string;
}

interface OrderCompletionParams extends BaseJobProcessorParams {
  earnings: Array<{
    currencyCode: string;
    amount: number;
    expiryDate: Date;
  }>;
  burningAmountDetails: {
    coin: Array<{
      currencyCode: string;
      amount: number;
    }>;
  };
}

@Injectable()
export class CustomerWalletJobConsumer implements OnModuleInit {
  private readonly logger = new Logger(CustomerWalletJobConsumer.name);

  constructor(
    private readonly jobSchedulerService: JobSchedulerService,
    private readonly customerWalletService: CustomerWalletService,
  ) {}

  async onModuleInit() {
    await this.defineJobs();
  }

  private async handlePointsExpiry({
    customerId,
    currencyCode,
    transactionRef,
  }: JobProcessorParams): Promise<void> {
    const initializedPoints = await this.customerWalletService.initialize(
      customerId,
      currencyCode,
    );
    await initializedPoints.handleCreditPointsExpiry({
      transactionRef,
      currencyCode,
      customerId,
    });
    await initializedPoints.save();
  }

  private async handleOrderCompletion(
    data: OrderCompletionParams,
  ): Promise<void> {
    // Handle burning amounts
    try {
      const burningPromises = data.burningAmountDetails.coin
        .filter((coin) => coin.amount > 0)
        .map(async (coin) => {
          const initializedCustomerPoints =
            await this.customerWalletService.initialize(
              data.customerId,
              coin.currencyCode,
            );

          await initializedCustomerPoints.debitBlockedPoints({
            currencyCode: coin.currencyCode,
            customerId: data.customerId,
            transactionRef: data.transactionRef,
          });

          return initializedCustomerPoints.save();
        });

      await Promise.all(burningPromises);
    } catch (error) {
      this.logger.error(
        'Error processing completing order updates customer wallet',
        error,
      );
      throw error;
    }

    // Handle earnings
    try {
      for (const earning of data.earnings) {
        const initializedCustomerPoints =
          await this.customerWalletService.initialize(
            data.customerId,
            earning.currencyCode,
          );

        const formattedExpiryDate = new Date(earning.expiryDate)
          .toISOString()
          .split('T')[0];

        await initializedCustomerPoints.creditPendingPoints({
          currencyCode: earning.currencyCode,
          customerId: data.customerId,
          transactionRef: data.transactionRef,
          expiryDate: formattedExpiryDate,
        });

        await initializedCustomerPoints.save();
      }
    } catch (error) {
      this.logger.error('Error processing earnings', error);
      throw error;
    }
  }

  private async handlePointsUnblocking({
    customerId,
    currencyCode,
    newTransaction,
  }: JobProcessorParams): Promise<void> {
    const initializedPoints = await this.customerWalletService.initialize(
      customerId,
      currencyCode,
    );
    await initializedPoints.unblockPoints({
      customerId,
      transactionRef: newTransaction.transactionRef,
      currencyCode,
    });
    await initializedPoints.save();
  }

  private defineJobWithErrorHandling({
    name,
    handler,
    options = {},
  }: JobDefinitionParams): void {
    this.jobSchedulerService.defineJob({
      name,
      processor: async (job: SchedulerJob) => {
        try {
          const data: JobProcessorParams = job.attrs
            .data as unknown as JobProcessorParams;
          await handler(data);
        } catch (error) {
          const data: JobProcessorParams = job.attrs
            .data as unknown as JobProcessorParams;
          this.logger.error(
            `Error processing job ${name} for customer ${data.customerId}`,
            error.stack,
          );
          throw error;
        }
      },
      options: {
        priority: options.priority || 'normal',
        concurrency: options.concurrency || 1,
        lockLifetime: options.lockLifetime || 30000,
      },
    });
  }

  private async defineJobs(): Promise<void> {
    this.defineJobWithErrorHandling({
      name: LongListEnumOfAgendaJobs.HANDLE_CUSTOMER_ORGANIZATION_ORDER_COMPLETING,
      handler: async (params) => {
        const orderParams = params as OrderCompletionParams;
        await this.handleOrderCompletion(orderParams);
      },
      options: {
        priority: 'high',
        concurrency: 3,
        lockLifetime: 60000, // 60 seconds since this job does more work
      },
    });

    // Handle Fulfill Points Expiry
    this.defineJobWithErrorHandling({
      name: LongListEnumOfAgendaJobs.HANDLE_FULFILL_POINTS_EXPIRY,
      handler: async (params) => await this.handlePointsExpiry(params),
      options: {
        priority: 'normal',
        concurrency: 3,
        lockLifetime: 30000,
      },
    });

    // Handle Block Points Unblocking
    this.defineJobWithErrorHandling({
      name: LongListEnumOfAgendaJobs.HANDLE_BLOCK_POINTS_UNBLOCKING,
      handler: async (params) => await this.handlePointsUnblocking(params),
      options: {
        priority: 'high',
        concurrency: 5,
        lockLifetime: 30000,
      },
    });
  }
}
