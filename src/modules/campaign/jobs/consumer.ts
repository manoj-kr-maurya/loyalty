import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LongListEnumOfAgendaJobs } from 'src/common/enums/jobs';
import {
  JobSchedulerService,
  SchedulerJob,
} from 'src/modules/jobs/job-scheduler.service';
import { CampaignExpiryReminderJobParams } from '../DTO/campaign.dto';
import { CampaignService } from '../campaign.service';
import { OrganizationService } from '../../organization/organization.service';
// Import your notification service here
// Import your campaign service to check if campaign still needs reminders

@Injectable()
export class CampaignJobConsumer implements OnModuleInit {
  private readonly logger = new Logger(CampaignJobConsumer.name);

  constructor(
    private readonly jobSchedulerService: JobSchedulerService,
    private readonly campaignService: CampaignService,
    private readonly organizationService: OrganizationService,
  ) {}

  async onModuleInit() {
    await this.defineJobs();
  }

  private defineJobWithErrorHandling({
    name,
    handler,
    options = {},
  }: {
    name: string;
    handler: (data: any) => Promise<void>;
    options?: {
      priority?: 'highest' | 'high' | 'normal' | 'low' | 'lowest';
      concurrency?: number;
      lockLifetime?: number;
    };
  }): void {
    this.jobSchedulerService.defineJob({
      name,
      processor: async (job: SchedulerJob) => {
        try {
          const data = job.attrs.data;
          await handler(data);
        } catch (error) {
          this.logger.error(
            `Error processing job ${name} for data ${JSON.stringify(
              job.attrs.data,
            )}`,
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
    // Handle campaign expiry notifications
    this.defineJobWithErrorHandling({
      name: LongListEnumOfAgendaJobs.CAMPAIGN_EXPIRY_REMINDER,
      handler: async (data) =>
        await this.handleCampaignExpiryNotifications(data),
      options: {
        priority: 'high',
        concurrency: 5,
        lockLifetime: 30000,
      },
    });
  }

  async handleCampaignExpiryNotifications(
    params: CampaignExpiryReminderJobParams,
  ) {
    this.logger.log(
      `Processing campaign expiry notification for campaign ${params.campaignId}, type: ${params.reminderType}`,
    );

    const campaign = await this.campaignService.getCampaignByCampaignId(
      params.campaignId,
    );
    const organizationId = campaign.organizationId;
    const organization = await this.organizationService.getOrganization(
      organizationId,
    );


    this.logger.log(
      `Successfully sent ${params.reminderType} notification for campaign ${params.campaignId}`,
    );
  }
}
