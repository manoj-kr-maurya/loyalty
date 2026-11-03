import { Module } from '@nestjs/common';
import { MailAndSmsService } from './mail-and-sms.service';
import { MailAndSmsController } from './mail-and-sms.controller';
import { ConfigService } from '@nestjs/config';
import { Factor2Module } from 'src/modules/factor2/factor2.module';
import { Factor2HttpModule } from 'src/modules/http/parties/factor2.http.module';
import { Factor2Service } from 'src/modules/factor2/factor2.service';
import { CommonUtilsService } from 'src/common/utils/common-utils.service';
import { JobSchedulerModule } from 'src/modules/jobs/job-scheduler.module';

@Module({
  imports: [Factor2HttpModule, Factor2Module, JobSchedulerModule],
  controllers: [MailAndSmsController],
  providers: [
    MailAndSmsService,
    ConfigService,
    Factor2Service,
    CommonUtilsService,
  ],
  exports: [MailAndSmsService],
})
export class MailAndSmsModule {}
