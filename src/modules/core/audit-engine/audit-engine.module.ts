import { Module } from '@nestjs/common';
import { AuditEngineService } from './audit-engine.service';
import { PrismaService } from '../../../common/services/prismaService';

@Module({
  providers: [AuditEngineService, PrismaService],
  exports: [AuditEngineService],
})
export class AuditEngineModule {}
