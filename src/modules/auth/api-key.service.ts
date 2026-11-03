import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

export const API_KEY_SCOPES = [
  'loyalty:read',
  'loyalty:write',
  'promo:read',
  'promo:write',
  'fx:read',
  'fx:write',
  'plb:read',
  'plb:write',
  'exchange:read',
  'exchange:write',
  'webhooks:manage',
  'api-keys:manage',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export interface OrganizationAuthContext {
  type: 'organization' | 'platform';
  organizationId?: string;
  apiKeyId?: string;
  scopes: string[];
}

export interface CreateApiKeyInput {
  organizationId: string;
  name?: string;
  scopes?: string[];
  expiresAt?: Date | null;
}

const KEY_PREFIX = 'loy';
const PREFIX_BYTES = 6;
const SECRET_BYTES = 32;
const MAX_PREFIX_ATTEMPTS = 3;

const SAFE_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  prefix: true,
  scopes: true,
  isActive: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateApiKeyInput) {
    const organization = await this.prisma.organization.findFirst({
      where: { id: input.organizationId, isSoftDeleted: false },
      select: { id: true },
    });

    if (!organization) {
      throw new CommonException(
        `Organization ${input.organizationId} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    if (input.expiresAt && input.expiresAt <= new Date()) {
      throw new CommonException(
        'expiresAt must be in the future',
        StatusCodes.BAD_REQUEST,
      );
    }

    const scopes = input.scopes?.length ? input.scopes : [...API_KEY_SCOPES];

    this.assertValidScopes(scopes);

    for (let attempt = 0; attempt < MAX_PREFIX_ATTEMPTS; attempt++) {
      const prefix = randomBytes(PREFIX_BYTES).toString('hex');
      const rawKey = `${KEY_PREFIX}_${prefix}_${randomBytes(
        SECRET_BYTES,
      ).toString('hex')}`;

      const collision = await this.prisma.organizationApiKey.findUnique({
        where: { prefix },
        select: { id: true },
      });

      if (collision) continue;

      const record = await this.prisma.organizationApiKey.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          prefix,
          keyHash: this.hash(rawKey),
          scopes,
          expiresAt: input.expiresAt ?? null,
        },
        select: SAFE_SELECT,
      });

      this.logger.log(
        `API key ${record.id} created for org ${input.organizationId}`,
      );

      return { ...record, key: rawKey };
    }

    throw new CommonException(
      'Could not allocate a unique API key prefix',
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  async validate(rawKey: string): Promise<OrganizationAuthContext | null> {
    const parts = rawKey.split('_');

    if (parts.length !== 3 || parts[0] !== KEY_PREFIX) {
      return null;
    }

    const [, prefix, secret] = parts;

    if (!prefix || !secret) {
      return null;
    }

    const record = await this.prisma.organizationApiKey.findUnique({
      where: { prefix },
    });

    if (
      !record ||
      !record.isActive ||
      record.revokedAt ||
      (record.expiresAt && record.expiresAt <= new Date())
    ) {
      return null;
    }

    if (!this.hashesMatch(rawKey, record.keyHash)) {
      return null;
    }

    void this.touch(record.id);

    return {
      type: 'organization',
      organizationId: record.organizationId,
      apiKeyId: record.id,
      scopes: record.scopes,
    };
  }

  async list(organizationId: string) {
    const keys = await this.prisma.organizationApiKey.findMany({
      where: { organizationId },
      select: SAFE_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return { data: keys };
  }

  async revoke(id: string, organizationId: string) {
    const result = await this.prisma.organizationApiKey.updateMany({
      where: { id, organizationId, revokedAt: null },
      data: { isActive: false, revokedAt: new Date() },
    });

    if (result.count === 0) {
      throw new CommonException(
        `API key ${id} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    this.logger.log(`API key ${id} revoked for org ${organizationId}`);

    return { id, revoked: true };
  }

  private assertValidScopes(scopes: string[]): void {
    const allowed = new Set<string>(API_KEY_SCOPES);
    const invalid = scopes.filter((scope) => !allowed.has(scope));

    if (invalid.length > 0) {
      throw new CommonException(
        `Unknown scope(s): ${invalid.join(', ')}`,
        StatusCodes.BAD_REQUEST,
      );
    }
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private hashesMatch(value: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(value), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');

    if (actual.length !== expected.length) return false;

    return timingSafeEqual(actual, expected);
  }

  private async touch(id: string): Promise<void> {
    try {
      await this.prisma.organizationApiKey.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(`Failed to update lastUsedAt for API key ${id}`);
    }
  }
}
