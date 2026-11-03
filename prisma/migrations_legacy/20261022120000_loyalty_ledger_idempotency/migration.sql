-- CreateEnum
CREATE TYPE "LoyaltyLedgerType" AS ENUM ('EARN', 'BURN', 'EXPIRE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'OPENING', 'REVERSAL');

-- CreateTable
CREATE TABLE "loyaltyLedgerEntry" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "type" "LoyaltyLedgerType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyaltyLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyaltyIdempotency" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response" JSONB,
    "resourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyaltyIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyaltyOutboxEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "loyaltyOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loyaltyLedgerEntry_customerId_organizationId_createdAt_idx" ON "loyaltyLedgerEntry"("customerId", "organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "loyaltyLedgerEntry_customerId_currencyCode_type_createdAt_idx" ON "loyaltyLedgerEntry"("customerId", "currencyCode", "type", "createdAt");

-- CreateIndex
CREATE INDEX "loyaltyLedgerEntry_referenceType_referenceId_idx" ON "loyaltyLedgerEntry"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "loyaltyIdempotency_expiresAt_idx" ON "loyaltyIdempotency"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "loyaltyIdempotency_organizationId_operation_key_key" ON "loyaltyIdempotency"("organizationId", "operation", "key");

-- CreateIndex
CREATE INDEX "loyaltyOutboxEvent_publishedAt_createdAt_idx" ON "loyaltyOutboxEvent"("publishedAt", "createdAt");

