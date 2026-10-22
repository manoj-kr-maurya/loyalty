import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prismaService';
import { CacheLockService } from 'src/common/services/cache-lock.service';
import { CommonException } from 'src/common/exceptions/common.exception';
import { StatusCodes } from 'src/common/enums/status-codes';

export interface FxConvertInput {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  tenantId?: string;
  lockRate?: boolean;
  lockDurationMinutes?: number;
}

export interface FxConvertOutput {
  referenceId: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  spread: number;
  lockedRate: boolean;
  lockedUntil?: Date;
  timestamp: Date;
}

export interface FxRateLockInput {
  currencyCode: string;
  physicalCurrencyCode: string;
  rate: number;
  lockedBy: string;
  lockDurationMinutes: number;
}

export interface FxHistoricalRateInput {
  currencyCode: string;
  physicalCurrencyCode: string;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class FXEngineService {
  private readonly logger = new Logger(FXEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheLock: CacheLockService,
  ) {}

  /**
   * Convert an amount from one currency to another.
   * Optionally locks the rate for a specified duration.
   */
  async convert(input: FxConvertInput): Promise<FxConvertOutput> {
    const {
      fromCurrency,
      toCurrency,
      amount,
      tenantId,
      lockRate = false,
      lockDurationMinutes = 15,
    } = input;

    if (amount <= 0) {
      throw new CommonException(
        'Amount must be greater than zero',
        StatusCodes.BAD_REQUEST,
      );
    }

    // Fetch the active exchange rate
    const rateRecord = await this.prisma.exchangeRateHistory.findFirst({
      where: {
        currencyId: fromCurrency,
        physicalCurrencyCode: toCurrency,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!rateRecord) {
      throw new CommonException(
        `No active exchange rate found for ${fromCurrency} → ${toCurrency}`,
        StatusCodes.NOT_FOUND,
      );
    }

    const rate = Number(rateRecord.rate);
    const spread = 0.005; // 0.5% default spread — configurable in production
    const effectiveRate = rate * (1 + spread);
    const toAmount = amount * effectiveRate;

    const referenceId = `FX-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    let lockedUntil: Date | undefined;
    if (lockRate) {
      lockedUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
      await this.prisma.exchangeRateHistory.update({
        where: { id: rateRecord.id },
        data: {
          lockedBy: tenantId || 'SYSTEM',
          lockedUntil,
        },
      });
    }

    // Write audit log
    await this.prisma.fxAuditLog.create({
      data: {
        referenceId,
        fromCurrency,
        toCurrency,
        fromAmount: amount,
        toAmount,
        rate: effectiveRate,
        spread,
        source: rateRecord.source,
        tenantId,
        lockedRate: lockRate,
      },
    });

    this.logger.log(
      `FX Convert: ${amount} ${fromCurrency} → ${toAmount.toFixed(2)} ${toCurrency} (rate: ${effectiveRate})`,
    );

    return {
      referenceId,
      fromCurrency,
      toCurrency,
      fromAmount: amount,
      toAmount: Math.round(toAmount * 100) / 100,
      rate: effectiveRate,
      spread,
      lockedRate: lockRate,
      lockedUntil,
      timestamp: new Date(),
    };
  }

  /**
   * Lock an exchange rate for a specified duration.
   */
  async lockRate(input: FxRateLockInput): Promise<{
    locked: boolean;
    rate: number;
    lockedUntil: Date;
  }> {
    const { currencyCode, physicalCurrencyCode, rate, lockedBy, lockDurationMinutes } = input;

    const lockedUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);

    await this.prisma.exchangeRateHistory.create({
      data: {
        currencyId: currencyCode,
        physicalCurrencyCode,
        rate,
        source: 'MANUAL',
        lockedBy: String(lockedBy),
        lockedUntil,
        isActive: true,
      },
    });

    this.logger.log(
      `Rate locked: ${currencyCode}/${physicalCurrencyCode} = ${rate} until ${lockedUntil.toISOString()}`,
    );

    return { locked: true, rate, lockedUntil };
  }

  /**
   * Fetch historical exchange rates for a currency pair.
   */
  async getHistoricalRates(input: FxHistoricalRateInput): Promise<{
    currencyCode: string;
    physicalCurrencyCode: string;
    rates: Array<{ rate: number; source: string; createdAt: Date }>;
  }> {
    const { currencyCode, physicalCurrencyCode, startDate, endDate } = input;

    const records = await this.prisma.exchangeRateHistory.findMany({
      where: {
        currencyId: currencyCode,
        physicalCurrencyCode,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        rate: true,
        source: true,
        createdAt: true,
      },
    });

    return {
      currencyCode,
      physicalCurrencyCode,
      rates: records.map((r) => ({
        rate: Number(r.rate),
        source: r.source,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * Generate an FX reconciliation report for a tenant.
   */
  async getReconciliationReport(input: {
    tenantId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    tenantId: string;
    period: { start: Date; end: Date };
    totalConversions: number;
    totalFromAmount: number;
    totalToAmount: number;
    averageRate: number;
    transactions: Array<{
      referenceId: string;
      fromCurrency: string;
      toCurrency: string;
      fromAmount: number;
      toAmount: number;
      rate: number;
      createdAt: Date;
    }>;
  }> {
    const { tenantId, startDate, endDate } = input;

    const transactions = await this.prisma.fxAuditLog.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalConversions = transactions.length;
    const totalFromAmount = transactions.reduce(
      (sum, t) => sum + Number(t.fromAmount),
      0,
    );
    const totalToAmount = transactions.reduce(
      (sum, t) => sum + Number(t.toAmount),
      0,
    );
    const averageRate =
      totalConversions > 0
        ? transactions.reduce((sum, t) => sum + Number(t.rate), 0) / totalConversions
        : 0;

    return {
      tenantId,
      period: { start: startDate, end: endDate },
      totalConversions,
      totalFromAmount,
      totalToAmount,
      averageRate,
      transactions: transactions.map((t) => ({
        referenceId: t.referenceId,
        fromCurrency: t.fromCurrency,
        toCurrency: t.toCurrency,
        fromAmount: Number(t.fromAmount),
        toAmount: Number(t.toAmount),
        rate: Number(t.rate),
        createdAt: t.createdAt,
      })),
    };
  }
}