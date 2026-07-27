import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthCheckController } from './health-check.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { PrismaService } from 'src/common/services/prismaService';
import { RedisService } from 'src/common/services/cache/redis.service';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthCheckController],
  providers: [
    PrismaHealthIndicator,
    RedisHealthIndicator,
    PrismaService,
    RedisService,
  ],
})
export class HealthCheckModule {}
