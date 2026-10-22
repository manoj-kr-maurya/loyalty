import { Module } from '@nestjs/common';
import { LoyaltyEngineService } from './loyalty-engine.service';
import { LoyaltyEngineController } from './loyalty-engine.controller';
import { PrismaService } from 'src/common/services/prismaService';

@Module({
  controllers: [LoyaltyEngineController],
  providers: [LoyaltyEngineService, PrismaService],
  exports: [LoyaltyEngineService],
})
export class LoyaltyEngineModule {}