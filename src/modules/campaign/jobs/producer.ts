import { Injectable, Logger } from '@nestjs/common';
import { LongListEnumOfAgendaJobs } from 'src/common/enums/jobs';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { JobSchedulerService } from 'src/modules/jobs/job-scheduler.service';
import {
  CampaignExpiryReminderJobParams,
  NotificationSchedule,
} from '../DTO/campaign.dto';
import { ConfigService } from '@nestjs/config';
import { envEnums } from 'src/config/enums';

interface JobResult {
  success: boolean;
  jobId?: string;
  error?: Error;
}

@Injectable()
export class CampaignJobProducer {
  private readonly logger = new Logger(CampaignJobProducer.name);
  private readonly notificationSchedule: NotificationSchedule[];

  constructor(
    private readonly jobSchedulerService: JobSchedulerService,
    private readonly commonUtilService: CommonUtilsService,
    private readonly configService: ConfigService,
  ) {
    // Define the notification schedule - can be moved to config if needed
    this.notificationSchedule = [
      {
        reminderType: 'initial',
        daysBeforeExpiry: this.configService.get<number>(
          envEnums.CAMPAIGN_REMINDER_DAYS,
        ),
        message:
          'Your campaign will expire in 5 days. Renew now to maintain continuity.',
        priority: 'normal',
      },
      {
        reminderType: 'followup1',
        daysBeforeExpiry: 3,
        message:
          'Your campaign expires in 3 days. Create a new campaign now to avoid interruption.',
        priority: 'high',
      },
      {
        reminderType: 'followup2',
        daysBeforeExpiry: 1,
        message:
          'Urgent: Your campaign expires tomorrow! Take action now to renew.',
        priority: 'highest',
      },
      {
        reminderType: 'final',
        daysBeforeExpiry: 0,
        message:
          'Your campaign expires today. Last chance to renew without interruption.',
        priority: 'highest',
      },
    ];
  }

  private async scheduleJob({
    jobType,
    data,
    idSuffix,
    when = 'now',
  }: {
    jobType: string;
    data: Record<string, any>;
    idSuffix: string;
    when?: Date | string;
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
        when,
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

  async addCampaignExpiryReminder(
    campaignId: string,
    endDate: Date,
  ): Promise<JobResult[]> {
    // First, clear any existing jobs for this campaign
    await this.deleteCampaignExpiryReminder(campaignId);

    const results: JobResult[] = [];

    // Schedule all notification jobs based on the configuration
    for (const schedule of this.notificationSchedule) {
      const reminderDate = new Date(endDate);
      reminderDate.setDate(reminderDate.getDate() - schedule.daysBeforeExpiry);

      // Skip if the reminder date is in the past
      if (reminderDate < new Date()) {
        this.logger.log(
          `Skipping ${schedule.reminderType} notification for campaign ${campaignId} as the date ${reminderDate} is in the past`,
        );
        continue;
      }

      const data: CampaignExpiryReminderJobParams = {
        campaignId,
        reminderType: schedule.reminderType,
        message: schedule.message,
      };

      const uniqueIdSuffix = `${campaignId}-${schedule.reminderType}`;

      const result = await this.scheduleJob({
        jobType: LongListEnumOfAgendaJobs.CAMPAIGN_EXPIRY_REMINDER,
        data,
        idSuffix: uniqueIdSuffix,
        when: reminderDate,
      });

      results.push(result);

      this.logger.log(
        `Scheduled ${schedule.reminderType} notification for campaign ${campaignId} at ${reminderDate}`,
      );
    }

    return results;
  }

  // Helper method to cancel all jobs for a campaign
  async deleteCampaignExpiryReminder(
    campaignId: string,
  ): Promise<{ success: boolean; error?: Error }> {
    const result = await this.jobSchedulerService.cancelJobs({
      query: {
        name: LongListEnumOfAgendaJobs.CAMPAIGN_EXPIRY_REMINDER,
        'data.campaignId': campaignId,
      },
    });

    if (result.success && result.count > 0) {
      this.logger.log(
        `Cancelled ${result.count} notification jobs for campaign ${campaignId}`,
      );
    }

    return {
      success: result.success,
      error: result.error,
    };
  }

  // Update a specific notification's timing if needed
  async updateCampaignExpiryReminderTime(
    jobId: string,
    newTime: Date,
  ): Promise<JobResult> {
    try {
      const result = await this.jobSchedulerService.updateJobNextRunAt(
        jobId,
        newTime,
      );

      if (result.success) {
        this.logger.log(`Updated job ${jobId} to run at ${newTime}`);
      }

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
}
