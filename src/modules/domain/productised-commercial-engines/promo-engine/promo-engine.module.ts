import { Module } from '@nestjs/common';
import { PromoEngineService } from './promo-engine.service';
import { PromoEngineController } from './promo-engine.controller';
import { PrismaService } from '../../../../common/services/prismaService';

@Module({
  controllers: [PromoEngineController],
  providers: [PromoEngineService, PrismaService],
  exports: [PromoEngineService],
})
export class PromoEngineModule {}