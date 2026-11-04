import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Supabase's session pooler caps the number of concurrent clients (pool_size).
 * Prisma's default pool (`num_cpus * 2 + 1`) can be far too high on hosts that
 * report many cores, and a rolling deploy briefly runs two instances at once.
 * Cap the pool unless the URL already specifies an explicit `connection_limit`.
 */
function withConnectionLimit(url?: string): string | undefined {
  if (!url || url.includes('connection_limit=')) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=5&pool_timeout=20`;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const url = withConnectionLimit(process.env.LSB_PG_URL);
    super({
      log: ['query', 'info', 'warn', 'error'],
      ...(url ? { datasources: { db: { url } } } : {}),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
