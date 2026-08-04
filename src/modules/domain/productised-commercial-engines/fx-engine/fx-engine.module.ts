import { Module } from '@nestjs/common';
import { FXEngineService } from './fx-engine.service';
import { FXEngineController } from './fx-engine.controller';
import { PrismaService } from '../../../../common/services/prismaService';
import { CacheLockService } from '../../../../common/services/cache-lock.service';

@Module({
  controllers: [FXEngineController],
  providers: [FXEngineService, PrismaService, CacheLockService],
  exports: [FXEngineService],
})
export class FXEngineModule {}