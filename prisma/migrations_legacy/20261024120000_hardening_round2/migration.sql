-- Currency codes are unique per organization, not globally.
DROP INDEX IF EXISTS "currency_code_key";
CREATE UNIQUE INDEX "organization_id_currency_code_currency" ON "currency"("organizationId", "code");

-- Payment evidence for organization currency purchases.
ALTER TABLE "organizationOrder" ADD COLUMN "paymentReference" TEXT;
ALTER TABLE "organizationOrder" ADD COLUMN "paymentAmount" DOUBLE PRECISION;
ALTER TABLE "organizationOrder" ADD COLUMN "paymentProvider" TEXT;
ALTER TABLE "organizationOrder" ADD COLUMN "paymentConfirmedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "organizationOrder_paymentReference_key" ON "organizationOrder"("paymentReference");
CREATE INDEX "organizationOrder_organizationId_orderStatus_idx" ON "organizationOrder"("organizationId", "orderStatus");

-- Wallets are scoped to an organization as well as a currency code.
ALTER TABLE "customerWallet" ADD COLUMN "organizationId" TEXT;
UPDATE "customerWallet" AS w
SET "organizationId" = c."organizationId"
FROM "currency" AS c
WHERE c."code" = w."currencyCode";
DELETE FROM "customerWallet" WHERE "organizationId" IS NULL;
ALTER TABLE "customerWallet" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "customerWallet_customerId_currencyCode_key";
CREATE UNIQUE INDEX "customerWallet_customerId_organizationId_currencyCode_key" ON "customerWallet"("customerId", "organizationId", "currencyCode");
CREATE INDEX "customerWallet_organizationId_idx" ON "customerWallet"("organizationId");

-- The same transaction reference must not be booked twice against a pocket.
DELETE FROM "customerWalletPocketTransaction" AS a
USING "customerWalletPocketTransaction" AS b
WHERE a.ctid < b.ctid
  AND a."customerWalletPocketId" = b."customerWalletPocketId"
  AND a."transactionRef" = b."transactionRef";
CREATE UNIQUE INDEX "wallet_pocket_transaction_ref" ON "customerWalletPocketTransaction"("customerWalletPocketId", "transactionRef");

-- Consume locked FX rates exactly once.
ALTER TABLE "exchangeRateHistory" ADD COLUMN "consumedAt" TIMESTAMP(3);
CREATE INDEX "exchangeRateHistory_lock_idx" ON "exchangeRateHistory"("currencyId", "physicalCurrencyCode", "lockedUntil");

-- PLB metrics and bonuses are idempotent per period/cycle.
DELETE FROM "plbMetric" AS a
USING "plbMetric" AS b
WHERE a.ctid < b.ctid
  AND a."programId" = b."programId"
  AND a."entityId" = b."entityId"
  AND a."periodStart" = b."periodStart"
  AND a."periodEnd" = b."periodEnd"
  AND a."metricName" = b."metricName";
CREATE UNIQUE INDEX "plbMetric_programId_entityId_periodStart_periodEnd_metricName_key"
  ON "plbMetric"("programId", "entityId", "periodStart", "periodEnd", "metricName");

DELETE FROM "plbBonus" AS a
USING "plbBonus" AS b
WHERE a.ctid < b.ctid
  AND a."programId" = b."programId"
  AND a."entityId" = b."entityId"
  AND a."cycleStart" = b."cycleStart"
  AND a."cycleEnd" = b."cycleEnd";
CREATE UNIQUE INDEX "plbBonus_programId_entityId_cycleStart_cycleEnd_key"
  ON "plbBonus"("programId", "entityId", "cycleStart", "cycleEnd");

-- Durable exchange quotes (replaces the in-memory map).
CREATE TABLE "exchangeQuote" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "sourceCustomerId" TEXT NOT NULL,
    "sourceAmount" INTEGER NOT NULL,
    "targetAmount" INTEGER NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "conversionRatio" DECIMAL(10,6) NOT NULL,
    "spread" DECIMAL(10,6) NOT NULL,
    "effectiveRate" DECIMAL(10,6) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exchangeQuote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "exchangeQuote_sourceEntityId_sourceCustomerId_idx" ON "exchangeQuote"("sourceEntityId", "sourceCustomerId");
CREATE INDEX "exchangeQuote_expiresAt_idx" ON "exchangeQuote"("expiresAt");
