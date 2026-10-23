import { Module } from '@nestjs/common';
import { LoyaltyEngineService } from './loyalty-engine.service';
import { LoyaltyEngineController } from './loyalty-engine.controller';
import { PrismaService } from 'src/common/services/prismaService';
import { OutgoingHttpModule } from 'src/modules/http/http.module';
import { JobSchedulerModule } from 'src/modules/jobs/job-scheduler.module';
import { EarningCalculatorService } from './services/earning-calculator.service';
import { IdempotencyService } from './services/idempotency.service';
import { LedgerQueryService } from './services/ledger-query.service';
import { OutboxService } from './services/outbox.service';
import { WalletLedgerService } from './services/wallet-ledger.service';
import { WebhookDispatcherService } from './services/webhook-dispatcher.service';
import { WebhookService } from './services/webhook.service';

@Module({
  imports: [OutgoingHttpModule, JobSchedulerModule],
  controllers: [LoyaltyEngineController],
  providers: [
    LoyaltyEngineService,
    EarningCalculatorService,
    IdempotencyService,
    LedgerQueryService,
    OutboxService,
    WalletLedgerService,
    WebhookService,
    WebhookDispatcherService,
    PrismaService,
  ],
  exports: [LoyaltyEngineService],
})
export class LoyaltyEngineModule {}
