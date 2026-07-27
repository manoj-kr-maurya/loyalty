import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { PrismaService } from 'src/common/services/prismaService';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(PrismaHealthIndicator.name);

  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Execute a simple query to check if the database is responsive
      await this.prismaService.$queryRaw`SELECT 1`;

      return this.getStatus(key, true);
    } catch (error) {
      this.logger.error(
        `Prisma health check failed: ${error.message}`,
        error.stack,
      );

      throw new HealthCheckError(
        'Prisma health check failed',
        this.getStatus(key, false, { message: error.message }),
      );
    }
  }
}
