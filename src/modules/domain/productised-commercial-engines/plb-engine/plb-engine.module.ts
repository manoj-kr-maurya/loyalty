import { Module } from '@nestjs/common';
import { PLBEngineService } from './plb-engine.service';
import { PLBEngineController } from './plb-engine.controller';
import { PrismaService } from '../../../../common/services/prismaService';

@Module({
  controllers: [PLBEngineController],
  providers: [PLBEngineService, PrismaService],
  exports: [PLBEngineService],
})
export class PLBEngineModule {}