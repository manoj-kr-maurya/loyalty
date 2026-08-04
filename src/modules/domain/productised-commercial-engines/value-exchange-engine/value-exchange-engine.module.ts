import { Module } from '@nestjs/common';
import { ValueExchangeEngineService } from './value-exchange-engine.service';
import { ValueExchangeEngineController } from './value-exchange-engine.controller';
import { PrismaService } from '../../../../common/services/prismaService';

@Module({
  controllers: [ValueExchangeEngineController],
  providers: [ValueExchangeEngineService, PrismaService],
  exports: [ValueExchangeEngineService],
})
export class ValueExchangeEngineModule {}