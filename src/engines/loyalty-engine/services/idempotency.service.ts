import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { LoyaltyIdempotency, Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

export interface IdempotencyOptions<T> {
  key?: string;
  operation: string;
  organizationId: string;
  customerId?: string;
  request: unknown;
  ttlSeconds?: number;
  resourceId?: (result: T) => string | undefined;
  work: (tx: Prisma.TransactionClient) => Promise<T>;
}

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const SERIALIZABLE_RETRIES = 3;

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(options: IdempotencyOptions<T>): Promise<T> {
    if (!options.key) {
      return this.runTransaction(options.work);
    }

    const requestHash = this.hashRequest(options.request);
    const uniqueWhere = {
      organizationId_operation_key: {
        organizationId: options.organizationId,
        operation: options.operation,
        key: options.key,
      },
    };

    const existing = await this.prisma.loyaltyIdempotency.findUnique({
      where: uniqueWhere,
    });
    if (existing) {
      return this.resolveExisting<T>(existing, requestHash);
    }

    for (let attempt = 0; attempt < SERIALIZABLE_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.loyaltyIdempotency.create({
              data: {
                key: options.key,
                operation: options.operation,
                organizationId: options.organizationId,
                customerId: options.customerId,
                requestHash,
                status: 'PROCESSING',
                expiresAt: new Date(
                  Date.now() +
                    (options.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000,
                ),
              },
            });

            const result = await options.work(tx);

            await tx.loyaltyIdempotency.update({
              where: uniqueWhere,
              data: {
                status: 'COMPLETED',
                response: this.toJson(result),
                resourceId: options.resourceId?.(result),
              },
            });

            return result;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 15000,
            maxWait: 5000,
          },
        );
      } catch (error) {
        if (
          this.isSerializationFailure(error) &&
          attempt < SERIALIZABLE_RETRIES - 1
        ) {
          await this.sleep(25 * (attempt + 1));
          continue;
        }

        if (this.isUniqueViolation(error)) {
          const competing = await this.waitForExisting(uniqueWhere);
          if (competing) {
            return this.resolveExisting<T>(competing, requestHash);
          }
          throw new CommonException(
            'A request with this idempotency key is already in progress',
            StatusCodes.CONFLICT,
          );
        }

        throw error;
      }
    }

    throw new CommonException(
      'Unable to complete the request due to concurrent updates. Please retry.',
      StatusCodes.CONFLICT,
    );
  }

  private async runTransaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < SERIALIZABLE_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
          maxWait: 5000,
        });
      } catch (error) {
        if (
          this.isSerializationFailure(error) &&
          attempt < SERIALIZABLE_RETRIES - 1
        ) {
          await this.sleep(25 * (attempt + 1));
          continue;
        }
        throw error;
      }
    }

    throw new CommonException(
      'Unable to complete the request due to concurrent updates. Please retry.',
      StatusCodes.CONFLICT,
    );
  }

  private resolveExisting<T>(
    existing: LoyaltyIdempotency,
    requestHash: string,
  ): T {
    if (existing.requestHash !== requestHash) {
      throw new CommonException(
        'Idempotency key was reused with a different request payload',
        StatusCodes.CONFLICT,
      );
    }

    if (existing.status === 'COMPLETED') {
      return existing.response as unknown as T;
    }

    throw new CommonException(
      'A request with this idempotency key is already in progress',
      StatusCodes.CONFLICT,
    );
  }

  private async waitForExisting(where: {
    organizationId_operation_key: {
      organizationId: string;
      operation: string;
      key: string;
    };
  }): Promise<LoyaltyIdempotency | null> {
    for (let i = 0; i < 20; i++) {
      const row = await this.prisma.loyaltyIdempotency.findUnique({ where });
      if (row?.status === 'COMPLETED') {
        return row;
      }
      await this.sleep(50);
    }
    return this.prisma.loyaltyIdempotency.findUnique({ where });
  }

  private hashRequest(request: unknown): string {
    return createHash('sha256')
      .update(this.stableStringify(request))
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === undefined) return 'null';
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${this.stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string })?.code === 'P2002';
  }

  private isSerializationFailure(error: unknown): boolean {
    return (error as { code?: string })?.code === 'P2034';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
