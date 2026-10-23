import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';
import { CallStatuses, StatusCodes } from 'src/common/enums/status-codes';
import { getPaginationMetadata } from 'src/common/utils/pagination.util';
import {
  CreateWebhookDto,
  WebhookDeliveryQueryDto,
  WebhookEndpointQueryDto,
} from '../dto/webhook.dto';

const ENDPOINT_SELECT = {
  id: true,
  organizationId: true,
  url: true,
  events: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const MIN_SECRET_LENGTH = 16;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createEndpoint(input: CreateWebhookDto) {
    this.assertSafeUrl(input.url);

    if (input.secret && input.secret.length < MIN_SECRET_LENGTH) {
      throw new CommonException(
        `Webhook secret must be at least ${MIN_SECRET_LENGTH} characters`,
        StatusCodes.BAD_REQUEST,
      );
    }

    const endpoint = await this.prisma.loyaltyWebhookEndpoint.create({
      data: {
        organizationId: input.organizationId,
        url: input.url,
        secret: input.secret ?? randomBytes(32).toString('hex'),
        events: input.events ?? [],
        description: input.description,
        isActive: input.isActive ?? true,
      },
    });

    this.logger.log(
      `Webhook endpoint ${endpoint.id} registered for org ${input.organizationId}`,
    );

    return endpoint;
  }

  async listEndpoints(query: WebhookEndpointQueryDto) {
    const endpoints = await this.prisma.loyaltyWebhookEndpoint.findMany({
      where: {
        organizationId: query.organizationId,
        ...(!query.includeInactive && { isActive: true }),
      },
      select: ENDPOINT_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return {
      status: CallStatuses.Success,
      data: endpoints,
    };
  }

  async deleteEndpoint(id: string, organizationId: string) {
    const result = await this.prisma.loyaltyWebhookEndpoint.deleteMany({
      where: { id, organizationId },
    });

    if (result.count === 0) {
      throw new CommonException(
        `Webhook endpoint ${id} not found`,
        StatusCodes.NOT_FOUND,
      );
    }

    this.logger.log(`Webhook endpoint ${id} deleted for org ${organizationId}`);

    return {
      status: CallStatuses.Success,
      data: { id, deleted: true },
    };
  }

  async listDeliveries(query: WebhookDeliveryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.LoyaltyWebhookDeliveryWhereInput = {
      organizationId: query.organizationId,
      ...(query.endpointId && { endpointId: query.endpointId }),
      ...(query.status && { status: query.status }),
    };

    const [deliveries, totalItems] = await Promise.all([
      this.prisma.loyaltyWebhookDelivery.findMany({
        where,
        include: { endpoint: { select: { url: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.loyaltyWebhookDelivery.count({ where }),
    ]);

    const metadata =
      totalItems === 0
        ? {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limit,
            hasNextPage: false,
            hasPreviousPage: false,
            startItem: 0,
            endItem: 0,
          }
        : getPaginationMetadata(totalItems, page, limit);

    return {
      status: CallStatuses.Success,
      data: deliveries,
      metadata,
    };
  }

  /**
   * Rejects non-HTTP protocols everywhere and private/loopback destinations in
   * production, preventing the webhook registry from becoming an SSRF pivot.
   */
  private assertSafeUrl(raw: string): void {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new CommonException('Invalid webhook URL', StatusCodes.BAD_REQUEST);
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new CommonException(
        'Webhook URL must use http or https',
        StatusCodes.BAD_REQUEST,
      );
    }

    if (process.env.NODE_ENV !== 'production') return;

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const isPrivate =
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

    if (isPrivate) {
      throw new CommonException(
        'Webhook URL must resolve to a public address',
        StatusCodes.BAD_REQUEST,
      );
    }
  }
}
