import { Module } from '@nestjs/common';
import { LoyaltyEngineService } from './loyalty-engine.service';
import { LoyaltyEngineController } from './loyalty-engine.controller';
import { PrismaService } from 'src/common/services/prismaService';
import { EarningCalculatorService } from './services/earning-calculator.service';
import { IdempotencyService } from './services/idempotency.service';
import { WalletLedgerService } from './services/wallet-ledger.service';
import { LedgerQueryService } from './services/ledger-query.service';

@Module({
  controllers: [LoyaltyEngineController],
  providers: [
    LoyaltyEngineService,
    EarningCalculatorService,
    IdempotencyService,
    WalletLedgerService,
    LedgerQueryService,
    PrismaService,
  ],
  exports: [LoyaltyEngineService],
})
export class LoyaltyEngineModule {}
