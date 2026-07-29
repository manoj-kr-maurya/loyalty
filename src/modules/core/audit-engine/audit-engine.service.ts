import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prismaService';

export interface AuditEntry {
  entityType: string;
  entityId?: string;
  action: string;
  actor?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit Engine — persists audit logs for compliance and traceability.
 * All reward operations (block, award, reverse, expire) are audited.
 */
@Injectable()
export class AuditEngineService {
  private readonly logger = new Logger(AuditEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist an audit log entry to the database.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          action: entry.action,
          actor: entry.actor ?? null,
          details: entry.details ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (error) {
      // Never let audit failure break the main flow
      this.logger.error(`Audit log failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Log multiple audit entries in batch.
   */
  async logBatch(entries: AuditEntry[]): Promise<void> {
    if (entries.length === 0) return;
    try {
      await this.prisma.auditLog.createMany({
        data: entries.map((e) => ({
          entityType: e.entityType,
          entityId: e.entityId ?? null,
          action: e.action,
          actor: e.actor ?? null,
          details: e.details ?? null,
          ipAddress: e.ipAddress ?? null,
          userAgent: e.userAgent ?? null,
        })),
      });
    } catch (error) {
      this.logger.error(`Batch audit log failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Query audit logs for a specific entity.
   */
  async getAuditTrail(
    entityType: string,
    entityId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}
