import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/services/prismaService';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

// ─── Input / Output Types ───────────────────────────────

export interface CreateAgreementInput {
  sourceEntityId: string;
  targetEntityId: string;
  name: string;
  sourceCurrency: string;
  targetCurrency: string;
  conversionRatio: number;
  minAmount?: number;
  maxAmount?: number;
  dailyCap?: number;
  monthlyCap?: number;
  isActive?: boolean;
  trustModel?: string;
  settlementModel?: string;
  breakageOwner?: string;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
}

export interface ExchangeQuoteInput {
  agreementId: string;
  sourceEntityId: string;
  sourceCustomerId: string;
  sourceAmount: number;
}

export interface ExchangeQuoteOutput {
  quoteId: string;
  agreementId: string;
  sourceAmount: number;
  sourceCurrency: string;
  targetAmount: number;
  targetCurrency: string;
  conversionRatio: number;
  spread: number;
  effectiveRate: number;
  expiresAt: Date;
}

export interface ExchangeExecuteInput {
  quoteId: string;
  sourceEntityId: string;
  sourceCustomerId: string;
}

export interface ExchangeOrderOutput {
  orderId: string;
  referenceId: string;
  status: string;
  sourceAmount: number;
  sourceCurrency: string;
  targetAmount: number;
  targetCurrency: string;
  effectiveRate: number;
  executedAt: Date;
}

@Injectable()
export class ValueExchangeEngineService {
  private readonly logger = new Logger(ValueExchangeEngineService.name);
  private readonly DEFAULT_SPREAD = 0.005; // 0.5%
  private readonly QUOTE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) {}

  // ─── Agreement Management ─────────────────────────────

  /**
   * Create an exchange agreement between two organizations.
   */
  async createAgreement(input: CreateAgreementInput): Promise<{
    id: string;
    name: string;
    sourceCurrency: string;
    targetCurrency: string;
    conversionRatio: number;
  }> {
    const {
      sourceEntityId,
      targetEntityId,
      name,
      sourceCurrency,
      targetCurrency,
      conversionRatio,
      minAmount,
      maxAmount,
      dailyCap,
      monthlyCap,
      isActive,
      trustModel,
      settlementModel,
      breakageOwner,
      effectiveFrom,
      effectiveUntil,
    } = input;

    if (!Number.isFinite(conversionRatio) || conversionRatio <= 0) {
      throw new CommonException(
        'conversionRatio must be greater than zero',
        StatusCodes.BAD_REQUEST,
      );
    }
    for (const [name, value] of Object.entries({
      minAmount,
      maxAmount,
      dailyCap,
      monthlyCap,
    })) {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        throw new CommonException(
          `${name} must be a non-negative integer`,
          StatusCodes.BAD_REQUEST,
        );
      }
    }
    if (
      minAmount !== undefined &&
      maxAmount !== undefined &&
      minAmount > maxAmount
    ) {
      throw new CommonException(
        'minAmount cannot be greater than maxAmount',
        StatusCodes.BAD_REQUEST,
      );
    }

    // Prevent self-exchange
    if (sourceEntityId === targetEntityId) {
      throw new CommonException(
        'Cannot create exchange agreement with self',
        StatusCodes.BAD_REQUEST,
      );
    }

    // Check for duplicate agreement
    const existing = await this.prisma.exchangeAgreement.findFirst({
      where: {
        sourceEntityId,
        targetEntityId,
        sourceCurrency,
        targetCurrency,
      },
    });

    if (existing) {
      throw new CommonException(
        'Exchange agreement already exists for these currencies',
        StatusCodes.CONFLICT,
      );
    }

    const agreement = await this.prisma.exchangeAgreement.create({
      data: {
        sourceEntityId,
        targetEntityId,
        name,
        sourceCurrency,
        targetCurrency,
        conversionRatio,
        minAmount,
        maxAmount,
        dailyCap,
        monthlyCap,
        isActive: isActive ?? true,
        trustModel: trustModel ?? 'BILATERAL',
        settlementModel: settlementModel ?? 'REAL_TIME',
        breakageOwner: breakageOwner ?? 'ISSUER',
        effectiveFrom: effectiveFrom || new Date(),
        effectiveUntil,
      },
    });

    this.logger.log(
      `Exchange agreement created: ${name} (${sourceCurrency}→${targetCurrency} @ ${conversionRatio})`,
    );

    return {
      id: agreement.id,
      name: agreement.name,
      sourceCurrency: agreement.sourceCurrency,
      targetCurrency: agreement.targetCurrency,
      conversionRatio: Number(agreement.conversionRatio),
    };
  }

  /**
   * Get all exchange agreements for an organization.
   */
  async getAgreements(sourceEntityId: string): Promise<
    Array<{
      id: string;
      name: string;
      sourceCurrency: string;
      targetCurrency: string;
      conversionRatio: number;
      isActive: boolean;
    }>
  > {
    const agreements = await this.prisma.exchangeAgreement.findMany({
      where: { sourceEntityId },
    });

    return agreements.map((a) => ({
      id: a.id,
      name: a.name,
      sourceCurrency: a.sourceCurrency,
      targetCurrency: a.targetCurrency,
      conversionRatio: Number(a.conversionRatio),
      isActive: a.isActive,
    }));
  }

  // ─── Quote ────────────────────────────────────────────

  /**
   * Get a real-time exchange quote (valid for 5 minutes).
   */
  async getQuote(input: ExchangeQuoteInput): Promise<ExchangeQuoteOutput> {
    const { agreementId, sourceEntityId, sourceCustomerId, sourceAmount } =
      input;

    if (!Number.isInteger(sourceAmount) || sourceAmount <= 0) {
      throw new CommonException(
        'sourceAmount must be a positive integer',
        StatusCodes.BAD_REQUEST,
      );
    }

    const agreement = await this.prisma.exchangeAgreement.findFirst({
      where: { id: agreementId, sourceEntityId },
    });

    if (!agreement) {
      throw new CommonException(
        'Exchange agreement not found',
        StatusCodes.NOT_FOUND,
      );
    }

    this.assertAgreementUsable(agreement);

    if (agreement.minAmount && sourceAmount < agreement.minAmount) {
      throw new CommonException(
        `Minimum exchange amount is ${agreement.minAmount}`,
        StatusCodes.BAD_REQUEST,
      );
    }
    if (agreement.maxAmount && sourceAmount > agreement.maxAmount) {
      throw new CommonException(
        `Maximum exchange amount is ${agreement.maxAmount}`,
        StatusCodes.BAD_REQUEST,
      );
    }

    await this.assertCapAvailable(this.prisma, agreement, sourceAmount);

    const spread = this.DEFAULT_SPREAD;
    const baseRate = Number(agreement.conversionRatio);
    const effectiveRate = baseRate * (1 - spread);
    const targetAmount = Math.round(sourceAmount * effectiveRate);
    const expiresAt = new Date(Date.now() + this.QUOTE_TTL_MS);

    const stored = await this.prisma.exchangeQuote.create({
      data: {
        agreementId: agreement.id,
        sourceEntityId,
        sourceCustomerId,
        sourceAmount,
        targetAmount,
        sourceCurrency: agreement.sourceCurrency,
        targetCurrency: agreement.targetCurrency,
        conversionRatio: baseRate,
        spread,
        effectiveRate,
        expiresAt,
      },
    });

    this.logger.log(
      `Quote generated: ${stored.id} ${sourceAmount} ${agreement.sourceCurrency} → ${targetAmount} ${agreement.targetCurrency}`,
    );

    return {
      quoteId: stored.id,
      agreementId: agreement.id,
      sourceAmount,
      sourceCurrency: agreement.sourceCurrency,
      targetAmount,
      targetCurrency: agreement.targetCurrency,
      conversionRatio: baseRate,
      spread,
      effectiveRate: Math.round(effectiveRate * 10000) / 10000,
      expiresAt,
    };
  }

  // ─── Execute ──────────────────────────────────────────

  /**
   * Execute an exchange order from a quote.
   */
  async execute(input: ExchangeExecuteInput): Promise<ExchangeOrderOutput> {
    const { quoteId, sourceEntityId, sourceCustomerId } = input;

    return this.prisma.$transaction(
      async (tx) => {
        const quote = await tx.exchangeQuote.findFirst({
          where: {
            id: quoteId,
            sourceEntityId,
            sourceCustomerId,
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
        });

        if (!quote) {
          throw new CommonException(
            'Quote not found, expired, or belongs to another customer',
            StatusCodes.NOT_FOUND,
          );
        }

        const agreement = await tx.exchangeAgreement.findFirst({
          where: { id: quote.agreementId, sourceEntityId },
        });

        if (!agreement) {
          throw new CommonException(
            'Exchange agreement not found',
            StatusCodes.NOT_FOUND,
          );
        }

        this.assertAgreementUsable(agreement);
        await this.assertCapAvailable(tx, agreement, quote.sourceAmount);

        const claimed = await tx.exchangeQuote.updateMany({
          where: {
            id: quote.id,
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { consumedAt: new Date() },
        });

        if (claimed.count === 0) {
          throw new CommonException(
            'Quote has already been consumed or expired',
            StatusCodes.CONFLICT,
          );
        }

        const referenceId = `EXC-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`;

        const order = await tx.exchangeOrder.create({
          data: {
            agreementId: quote.agreementId,
            sourceEntityId,
            targetEntityId: agreement.targetEntityId,
            sourceCustomerId,
            sourceAmount: quote.sourceAmount,
            targetAmount: quote.targetAmount,
            conversionRate: quote.effectiveRate,
            status: 'COMPLETED',
            referenceId,
          },
        });

        await tx.exchangeAuditLog.create({
          data: {
            exchangeOrderId: order.id,
            action: 'EXECUTED',
            details: {
              quoteId,
              sourceEntityId,
              sourceCustomerId,
              sourceAmount: quote.sourceAmount,
              sourceCurrency: quote.sourceCurrency,
              targetAmount: quote.targetAmount,
              targetCurrency: quote.targetCurrency,
              effectiveRate: Number(quote.effectiveRate),
            },
          },
        });

        this.logger.log(
          `Exchange executed: order=${order.id} ${quote.sourceAmount} ${quote.sourceCurrency} → ${quote.targetAmount} ${quote.targetCurrency}`,
        );

        return {
          orderId: order.id,
          referenceId: order.referenceId,
          status: order.status,
          sourceAmount: order.sourceAmount,
          sourceCurrency: quote.sourceCurrency,
          targetAmount: order.targetAmount,
          targetCurrency: quote.targetCurrency,
          effectiveRate: Number(order.conversionRate),
          executedAt: order.createdAt,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Reverse ──────────────────────────────────────────

  /**
   * Reverse a previously executed exchange order.
   */
  async reverse(input: {
    orderId: string;
    sourceEntityId: string;
    reason?: string;
  }): Promise<ExchangeOrderOutput> {
    const { orderId, sourceEntityId, reason } = input;

    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.exchangeOrder.findFirst({
          where: { id: orderId, sourceEntityId },
        });

        if (!order) {
          throw new CommonException(
            'Exchange order not found',
            StatusCodes.NOT_FOUND,
          );
        }

        if (order.status !== 'COMPLETED') {
          throw new CommonException(
            `Cannot reverse order with status: ${order.status}`,
            StatusCodes.BAD_REQUEST,
          );
        }

        const agreement = await tx.exchangeAgreement.findUnique({
          where: { id: order.agreementId },
        });

        if (!agreement) {
          throw new CommonException(
            'Exchange agreement not found',
            StatusCodes.NOT_FOUND,
          );
        }

        const claimed = await tx.exchangeOrder.updateMany({
          where: { id: orderId, status: 'COMPLETED' },
          data: {
            status: 'REVERSED',
            reversalReason: reason,
            reversedAt: new Date(),
          },
        });

        if (claimed.count === 0) {
          throw new CommonException(
            'Order was already reversed',
            StatusCodes.CONFLICT,
          );
        }

        const reversalReferenceId = `REV-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`;
        const conversionRate = 1 / Number(order.conversionRate);

        const reversal = await tx.exchangeOrder.create({
          data: {
            agreementId: order.agreementId,
            sourceEntityId: order.targetEntityId,
            targetEntityId: order.sourceEntityId,
            sourceCustomerId: order.targetCustomerId || order.sourceCustomerId,
            targetCustomerId: order.sourceCustomerId,
            sourceAmount: order.targetAmount,
            targetAmount: order.sourceAmount,
            conversionRate,
            status: 'REVERSED',
            referenceId: reversalReferenceId,
          },
        });

        await tx.exchangeAuditLog.create({
          data: {
            exchangeOrderId: reversal.id,
            action: 'REVERSED',
            details: {
              originalOrderId: orderId,
              reason,
              sourceAmount: order.targetAmount,
              targetAmount: order.sourceAmount,
              conversionRate,
            },
          },
        });

        this.logger.log(
          `Exchange reversed: original=${orderId} reversal=${reversal.id}`,
        );

        return {
          orderId: reversal.id,
          referenceId: reversal.referenceId,
          status: reversal.status,
          sourceAmount: reversal.sourceAmount,
          sourceCurrency: agreement.targetCurrency,
          targetAmount: reversal.targetAmount,
          targetCurrency: agreement.sourceCurrency,
          effectiveRate: Number(reversal.conversionRate),
          executedAt: reversal.createdAt,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── History ──────────────────────────────────────────

  /**
   * Get exchange order history for a customer.
   */
  async getOrderHistory(
    sourceCustomerId: string,
    sourceEntityId: string,
  ): Promise<{
    sourceCustomerId: string;
    sourceEntityId: string;
    totalOrders: number;
    orders: Array<{
      orderId: string;
      referenceId: string;
      status: string;
      sourceAmount: number;
      targetAmount: number;
      effectiveRate: number;
      executedAt: Date;
    }>;
  }> {
    const orders = await this.prisma.exchangeOrder.findMany({
      where: { sourceCustomerId, sourceEntityId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      sourceCustomerId,
      sourceEntityId,
      totalOrders: orders.length,
      orders: orders.map((o) => ({
        orderId: o.id,
        referenceId: o.referenceId,
        status: o.status,
        sourceAmount: o.sourceAmount,
        targetAmount: o.targetAmount,
        effectiveRate: Number(o.conversionRate),
        executedAt: o.createdAt,
      })),
    };
  }

  private assertAgreementUsable(agreement: {
    isActive: boolean;
    effectiveFrom: Date;
    effectiveUntil: Date | null;
  }) {
    if (!agreement.isActive) {
      throw new CommonException(
        'Exchange agreement is inactive',
        StatusCodes.BAD_REQUEST,
      );
    }

    const now = new Date();
    if (agreement.effectiveFrom && now < agreement.effectiveFrom) {
      throw new CommonException(
        'Exchange agreement has not started',
        StatusCodes.BAD_REQUEST,
      );
    }
    if (agreement.effectiveUntil && now > agreement.effectiveUntil) {
      throw new CommonException(
        'Exchange agreement has expired',
        StatusCodes.BAD_REQUEST,
      );
    }
  }

  private async assertCapAvailable(
    client: Prisma.TransactionClient | PrismaService,
    agreement: {
      id: string;
      dailyCap: number | null;
      monthlyCap: number | null;
    },
    sourceAmount: number,
  ) {
    const now = new Date();
    const dayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const [daily, monthly] = await Promise.all([
      agreement.dailyCap
        ? client.exchangeOrder.aggregate({
            where: {
              agreementId: agreement.id,
              status: 'COMPLETED',
              createdAt: { gte: dayStart },
            },
            _sum: { sourceAmount: true },
          })
        : Promise.resolve(null),
      agreement.monthlyCap
        ? client.exchangeOrder.aggregate({
            where: {
              agreementId: agreement.id,
              status: 'COMPLETED',
              createdAt: { gte: monthStart },
            },
            _sum: { sourceAmount: true },
          })
        : Promise.resolve(null),
    ]);

    if (
      agreement.dailyCap &&
      Number(daily?._sum.sourceAmount ?? 0) + sourceAmount > agreement.dailyCap
    ) {
      throw new CommonException(
        'Daily exchange cap exceeded',
        StatusCodes.BAD_REQUEST,
      );
    }

    if (
      agreement.monthlyCap &&
      Number(monthly?._sum.sourceAmount ?? 0) + sourceAmount >
        agreement.monthlyCap
    ) {
      throw new CommonException(
        'Monthly exchange cap exceeded',
        StatusCodes.BAD_REQUEST,
      );
    }
  }
}
