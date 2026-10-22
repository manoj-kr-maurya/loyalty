import { Module } from '@nestjs/common';
import { UsageEngineService } from './usage-engine.service';

@Module({
  providers: [UsageEngineService],
  exports: [UsageEngineService],
})
export class UsageEngineModule {}
