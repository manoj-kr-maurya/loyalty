import { Module } from '@nestjs/common';
import { JobSchedulerService } from './job-scheduler.service';

@Module({
  providers: [JobSchedulerService],
  exports: [JobSchedulerService],
})
export class JobSchedulerModule {}