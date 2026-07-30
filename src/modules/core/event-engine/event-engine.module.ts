import { Module } from '@nestjs/common';
import { EventEngineService } from './event-engine.service';

@Module({
  providers: [EventEngineService],
  exports: [EventEngineService],
})
export class EventEngineModule {}
