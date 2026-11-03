-- CreateEnum
CREATE TYPE "LoyaltyWebhookDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'EXHAUSTED');

-- CreateTable
CREATE TABLE "loyaltyWebhookEndpoint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyaltyWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyaltyWebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "outboxEventId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "LoyaltyWebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 6,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyaltyWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loyaltyWebhookEndpoint_organizationId_isActive_idx" ON "loyaltyWebhookEndpoint"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "loyaltyWebhookDelivery_endpointId_outboxEventId_key" ON "loyaltyWebhookDelivery"("endpointId", "outboxEventId");

-- CreateIndex
CREATE INDEX "loyaltyWebhookDelivery_status_nextAttemptAt_idx" ON "loyaltyWebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "loyaltyWebhookDelivery_organizationId_createdAt_idx" ON "loyaltyWebhookDelivery"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "loyaltyWebhookDelivery" ADD CONSTRAINT "loyaltyWebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "loyaltyWebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
