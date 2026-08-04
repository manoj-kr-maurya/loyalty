import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../common/services/prismaService';
import { CommonException } from '../../../../common/exceptions/common.exception';
import { StatusCodes } from '../../../../common/enums/status-codes';

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

  // In-memory quote store (production would use Redis)
  private quotes = new Map<string, { data: ExchangeQuoteOutput; expiresAt: number }>();

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
  async getAgreements(sourceEntityId: string): Promise<Array<{
    id: string;
    name: string;
    sourceCurrency: string;
    targetCurrency: string;
    conversionRatio: number;
    isActive: boolean;
  }>> {
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
    const { agreementId, sourceEntityId, sourceCustomerId, sourceAmount } = input;

    const agreement = await this.prisma.exchangeAgreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      throw new CommonException('Exchange agreement not found', StatusCodes.NOT_FOUND);
    }

    if (!agreement.isActive) {
      throw new CommonException('Exchange agreement is inactive', StatusCodes.BAD_REQUEST);
    }

    // Check date range
    const now = new Date();
    if (agreement.effectiveFrom && now < agreement.effectiveFrom) {
      throw new CommonException('Exchange agreement has not started', StatusCodes.BAD_REQUEST);
    }
    if (agreement.effectiveUntil && now > agreement.effectiveUntil) {
      throw new CommonException('Exchange agreement has expired', StatusCodes.BAD_REQUEST);
    }

    // Check amount bounds
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

    const spread = this.DEFAULT_SPREAD;
    const baseRate = Number(agreement.conversionRatio);
    const effectiveRate = baseRate * (1 - spread);
    const targetAmount = sourceAmount * effectiveRate;

    const quoteId = `QTE-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const quote: ExchangeQuoteOutput = {
      quoteId,
      agreementId,
      sourceAmount,
      sourceCurrency: agreement.sourceCurrency,
      targetAmount: Math.round(targetAmount * 100) / 100,
      targetCurrency: agreement.targetCurrency,
      conversionRatio: baseRate,
      spread,
      effectiveRate: Math.round(effectiveRate * 10000) / 10000,
      expiresAt: new Date(Date.now() + this.QUOTE_TTL_MS),
    };

    // Store quote in memory with TTL
    this.quotes.set(quoteId, {
      data: quote,
      expiresAt: Date.now() + this.QUOTE_TTL_MS,
    });

    this.logger.log(
      `Quote generated: ${quoteId} ${sourceAmount} ${agreement.sourceCurrency} → ${quote.targetAmount} ${agreement.targetCurrency}`,
    );

    return quote;
  }

  // ─── Execute ──────────────────────────────────────────

  /**
   * Execute an exchange order from a quote.
   */
  async execute(input: ExchangeExecuteInput): Promise<ExchangeOrderOutput> {
    const { quoteId, sourceEntityId, sourceCustomerId } = input;

    // Validate quote
    const stored = this.quotes.get(quoteId);
    if (!stored) {
      throw new CommonException('Quote not found or expired', StatusCodes.NOT_FOUND);
    }
    if (Date.now() > stored.expiresAt) {
      this.quotes.delete(quoteId);
      throw new CommonException('Quote has expired', StatusCodes.BAD_REQUEST);
    }

    const quote = stored.data;

    // Look up the agreement to get targetEntityId
    const agreement = await this.prisma.exchangeAgreement.findUnique({
      where: { id: quote.agreementId },
    });

    if (!agreement) {
      throw new CommonException('Exchange agreement not found', StatusCodes.NOT_FOUND);
    }

    const referenceId = `EXC-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Create exchange order
    const order = await this.prisma.exchangeOrder.create({
      data: {
        agreementId: quote.agreementId,
        sourceEntityId,
        targetEntityId: agreement.targetEntityId,
        sourceCustomerId,
        sourceAmount: Math.round(quote.sourceAmount),
        targetAmount: Math.round(quote.targetAmount),
        conversionRate: quote.effectiveRate,
        status: 'COMPLETED',
        referenceId,
      },
    });

    // Create audit log
    await this.prisma.exchangeAuditLog.create({
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
          effectiveRate: quote.effectiveRate,
        },
      },
    });

    // Consume the quote
    this.quotes.delete(quoteId);

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

    const order = await this.prisma.exchangeOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new CommonException('Exchange order not found', StatusCodes.NOT_FOUND);
    }

    if (order.status !== 'COMPLETED') {
      throw new CommonException(
        `Cannot reverse order with status: ${order.status}`,
        StatusCodes.BAD_REQUEST,
      );
    }

    // Fetch agreement to get currency codes
    const agreement = await this.prisma.exchangeAgreement.findUnique({
      where: { id: order.agreementId },
    });

    if (!agreement) {
      throw new CommonException('Exchange agreement not found', StatusCodes.NOT_FOUND);
    }

    const reversalReferenceId = `REV-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Create reversal order
    const reversal = await this.prisma.exchangeOrder.create({
      data: {
        agreementId: order.agreementId,
        sourceEntityId: order.targetEntityId,
        targetEntityId: order.sourceEntityId,
        sourceCustomerId: order.targetCustomerId || order.sourceCustomerId,
        targetCustomerId: order.sourceCustomerId,
        sourceAmount: order.targetAmount,
        targetAmount: order.sourceAmount,
        conversionRate: 1 / Number(order.conversionRate),
        status: 'REVERSED',
        referenceId: reversalReferenceId,
      },
    });

    // Update original order
    await this.prisma.exchangeOrder.update({
      where: { id: orderId },
      data: {
        status: 'REVERSED',
        reversalReason: reason,
        reversedAt: new Date(),
      },
    });

    // Audit log
    await this.prisma.exchangeAuditLog.create({
      data: {
        exchangeOrderId: reversal.id,
        action: 'REVERSED',
        details: {
          originalOrderId: orderId,
          reason,
          sourceAmount: order.targetAmount,
          targetAmount: order.sourceAmount,
          conversionRate: 1 / Number(order.conversionRate),
        },
      },
    });

    this.logger.log(`Exchange reversed: original=${orderId} reversal=${reversal.id}`);

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
  }

  // ─── History ──────────────────────────────────────────

  /**
   * Get exchange order history for a customer.
   */
  async getOrderHistory(sourceCustomerId: string, sourceEntityId: string): Promise<{
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
}