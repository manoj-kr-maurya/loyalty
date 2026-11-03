-- Squashed baseline migration.
-- Full public schema (all models in prisma/schema.prisma) as one migration.
-- Fresh databases: applied automatically by `prisma migrate deploy`.
-- Existing databases that already have this schema: mark as applied with
--   npx prisma migrate resolve --applied 0_init_full
-- (after clearing stale rows from _prisma_migrations).

-- CreateEnum
CREATE TYPE "RewardProgramType" AS ENUM ('PROMO', 'LOYALTY');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('APP', 'WEB', 'MWEB', 'ALL');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('COUPON', 'DISCOUNT', 'CASHBACK', 'GIFT', 'POINTS', 'TIER_UPGRADE', 'BADGE', 'COINS', 'CASHBACK_WALLET', 'PERCENTAGE', 'BUNDLE');

-- CreateEnum
CREATE TYPE "RewardMode" AS ENUM ('RATIO', 'ABSOLUTE', 'PERCENTAGE', 'MULTIPLIER', 'SLAB', 'MILESTONE');

-- CreateEnum
CREATE TYPE "RewardProgramStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RewardBlockStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CouponCodeStatus" AS ENUM ('AVAILABLE', 'BLOCKED', 'CLAIMED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RewardLedgerStatus" AS ENUM ('CREDITED', 'DEBITED', 'REVERSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PointTypes" AS ENUM ('AVAILABLE', 'BLOCKED', 'PENDING');

-- CreateEnum
CREATE TYPE "CustomerOrganizationOrderStatus" AS ENUM ('INITIATED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'HOLD');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS');

-- CreateEnum
CREATE TYPE "OrganizationOrderType" AS ENUM ('CURRENCY_PURCHASE');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('BANK_TRANSFER', 'PAYPAL', 'CRYPTO_WALLET', 'DEBIT_CARD');

-- CreateEnum
CREATE TYPE "PayoutFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "NotificationPreference" AS ENUM ('EMAIL', 'SMS', 'PUSH_NOTIFICATION');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('TRANSACTIONAL', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "TemplateSubtype" AS ENUM ('CUSTOMER_LOGIN_OTP', 'ORGANIZATION_LOGIN_OTP');

-- CreateEnum
CREATE TYPE "OrganizationOrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'HOLD');

-- CreateEnum
CREATE TYPE "PaymentGateways" AS ENUM ('PHONEPE', 'GPAY', 'PAYTM', 'STRIPE', 'PAYPAL');

-- CreateEnum
CREATE TYPE "CustomerWalletPocketTransactionStatus" AS ENUM ('BLOCKED', 'UNBLOCKED', 'AWARDED', 'CREDITED', 'PENDING', 'EXPIRED', 'DEBITED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrganizationRoles" AS ENUM ('ADMIN', 'SHOP');

-- CreateEnum
CREATE TYPE "LoyaltyLedgerType" AS ENUM ('EARN', 'BURN', 'EXPIRE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'OPENING', 'REVERSAL');

-- CreateEnum
CREATE TYPE "LoyaltyWebhookDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'EXHAUSTED');

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "kycStatus" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isSoftDeleted" BOOLEAN NOT NULL DEFAULT false,
    "role" "OrganizationRoles" NOT NULL DEFAULT 'ADMIN',
    "orgAdminId" TEXT,
    "fcmToken" TEXT,
    "address" TEXT,
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "upiURI" TEXT,
    "operationalHours" TEXT,
    "aboutUs" TEXT,
    "contactUs" TEXT,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metaFlagsForOrganization" (
    "id" TEXT NOT NULL,
    "initJourneyCompleted" BOOLEAN NOT NULL DEFAULT false,
    "firstCampaignCreated" BOOLEAN NOT NULL DEFAULT false,
    "firstCurrencyAdded" BOOLEAN NOT NULL DEFAULT false,
    "firstCurrencyBalanceAdded" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "metaFlagsForOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "externalId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "token" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fcmToken" TEXT,
    "logoUrl" TEXT,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metaFlagsForCustomer" (
    "id" TEXT NOT NULL,
    "initJourneyCompleted" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT NOT NULL,

    CONSTRAINT "metaFlagsForCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizationApiKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizationApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizationCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "earningPercentage" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isSoftDeleted" BOOLEAN NOT NULL DEFAULT false,
    "earningExpiresIn" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "organizationCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "symbol" TEXT NOT NULL DEFAULT '_',
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchangeRate" (
    "id" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "physicalCurrencyCode" TEXT NOT NULL DEFAULT 'INR',
    "rate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencyBucket" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "availableAmount" INTEGER NOT NULL DEFAULT 0,
    "distributedAmount" INTEGER NOT NULL DEFAULT 0,
    "receivedAmount" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "autoTopUpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoTopUpThreshold" INTEGER,
    "autoTopUpAmount" INTEGER,

    CONSTRAINT "currencyBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencyBucketTransaction" (
    "id" TEXT NOT NULL,
    "currencyBucketId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "CustomerWalletPocketTransactionStatus" NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "reversalTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencyBucketTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizationOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "orderType" "OrganizationOrderType" NOT NULL,
    "orderStatus" "OrganizationOrderStatus" NOT NULL,
    "paymentReference" TEXT,
    "paymentAmount" DOUBLE PRECISION,
    "paymentProvider" TEXT,
    "paymentConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "organizationOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizationOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "status" "OrganizationOrderStatus" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "organizationOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizationOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orderDetail" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "organizationOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orderDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customerWallet" (
    "id" TEXT NOT NULL,
    "availableBalance" INTEGER NOT NULL DEFAULT 0,
    "blockedBalance" INTEGER NOT NULL DEFAULT 0,
    "pendingBalance" INTEGER NOT NULL DEFAULT 0,
    "usedBalance" INTEGER NOT NULL DEFAULT 0,
    "expiredBalance" INTEGER NOT NULL DEFAULT 0,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customerWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customerWalletPocket" (
    "id" TEXT NOT NULL,
    "customerWalletId" TEXT NOT NULL,
    "availableBalance" INTEGER NOT NULL DEFAULT 0,
    "blockedBalance" INTEGER NOT NULL DEFAULT 0,
    "pendingBalance" INTEGER NOT NULL DEFAULT 0,
    "usedBalance" INTEGER NOT NULL DEFAULT 0,
    "expiredBalance" INTEGER NOT NULL DEFAULT 0,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customerWalletPocket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customerWalletPocketTransaction" (
    "id" TEXT NOT NULL,
    "customerWalletPocketId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "CustomerWalletPocketTransactionStatus" NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customerWalletPocketTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewardProgram" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "programType" "RewardProgramType" NOT NULL,
    "rewardType" "RewardType" NOT NULL,
    "status" "RewardProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "rewardCurrency" TEXT NOT NULL,
    "budgetEnabled" BOOLEAN NOT NULL DEFAULT false,
    "expiryNotification" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "business" TEXT,
    "category" TEXT,
    "couponCode" TEXT,
    "couponValue" DECIMAL(12,2),
    "subTitle" TEXT,
    "minBankAmount" DECIMAL(12,2),
    "minimumCartValue" DECIMAL(12,2),
    "maxDiscountValue" DECIMAL(12,2),
    "discountType" TEXT,
    "isStackable" BOOLEAN NOT NULL DEFAULT false,
    "applicableProducts" JSONB,
    "businessType" JSONB,
    "maxClaimsPerUser" INTEGER,
    "maxClaimsTotal" INTEGER,
    "attributes" JSONB,
    "channels" "Channel"[],
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timezone" TEXT DEFAULT 'UTC',
    "blackoutDates" JSONB,
    "workingDays" JSONB,
    "dailyTimeSlots" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewardProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewardProgramRule" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "rewardType" "RewardType" NOT NULL,
    "rewardMode" "RewardMode" NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "ratioBase" DECIMAL(65,30),
    "threshold" DECIMAL(65,30),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewardProgramRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couponCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "customerId" TEXT,
    "isUserSpecific" BOOLEAN NOT NULL DEFAULT true,
    "status" "CouponCodeStatus" NOT NULL DEFAULT 'AVAILABLE',
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER DEFAULT 1,
    "perUserLimit" INTEGER,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "couponCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewardBlock" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "awardDetails" JSONB NOT NULL,
    "status" "RewardBlockStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewardBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewardLedger" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "couponCodeId" TEXT,
    "rewardType" "RewardType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "details" JSONB,
    "transactionRef" TEXT,
    "idempotencyKey" TEXT,
    "status" "RewardLedgerStatus" NOT NULL DEFAULT 'CREDITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewardLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "totalBudget" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "usedBudget" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reservedBudget" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customerOrganizationOrder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "physicalCurrency" TEXT NOT NULL,
    "status" "CustomerOrganizationOrderStatus" NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customerOrganizationOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customerEarningAmountDetail" (
    "id" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerOrganizationOrderId" TEXT NOT NULL,

    CONSTRAINT "customerEarningAmountDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customerBurningAmountDetail" (
    "id" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerOrganizationOrderId" TEXT NOT NULL,

    CONSTRAINT "customerBurningAmountDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "burningCashAmountDetail" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerBurningAmountDetailId" TEXT NOT NULL,

    CONSTRAINT "burningCashAmountDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earningCoinAmountDetail" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerEarningAmountDetailId" TEXT NOT NULL,
    "earningExpiresIn" INTEGER NOT NULL,
    "organizationCampaignId" TEXT,

    CONSTRAINT "earningCoinAmountDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "burningCoinAmountDetail" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerBurningAmountDetailId" TEXT NOT NULL,

    CONSTRAINT "burningCoinAmountDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customerOrganizationOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "status" "CustomerOrganizationOrderStatus" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerOrganizationOrderId" TEXT NOT NULL,

    CONSTRAINT "customerOrganizationOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite" (
    "id" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "assignedTo" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "orgAdminId" TEXT,
    "role" "OrganizationRoles" NOT NULL DEFAULT 'SHOP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interest" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchangeRateHistory" (
    "id" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "physicalCurrencyCode" TEXT NOT NULL DEFAULT 'INR',
    "rate" DECIMAL(10,6) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchangeRateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fxAuditRecord" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "fromAmount" DECIMAL(18,6) NOT NULL,
    "toAmount" DECIMAL(18,6) NOT NULL,
    "rate" DECIMAL(10,6) NOT NULL,
    "spread" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "tenantId" TEXT,
    "lockedRate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fxAuditRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyaltyTier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "minPoints" INTEGER NOT NULL DEFAULT 0,
    "maxPoints" INTEGER,
    "multiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "benefits" JSONB,
    "color" TEXT,
    "iconUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyaltyTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customerTier" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "currentPoints" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "upgradedAt" TIMESTAMP(3),
    "downgradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customerTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyaltyStatement" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "earnedPoints" INTEGER NOT NULL DEFAULT 0,
    "redeemedPoints" INTEGER NOT NULL DEFAULT 0,
    "expiredPoints" INTEGER NOT NULL DEFAULT 0,
    "closingBalance" INTEGER NOT NULL DEFAULT 0,
    "tierAtStart" TEXT,
    "tierAtEnd" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyaltyStatement_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "promoCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "discountType" TEXT NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "minOrderAmount" DECIMAL(10,2),
    "maxDiscount" DECIMAL(10,2),
    "usageLimit" INTEGER,
    "perUserLimit" INTEGER DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isStackable" BOOLEAN NOT NULL DEFAULT false,
    "applicableProducts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promoRedemption" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderRef" TEXT,
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "orderAmount" DECIMAL(10,2) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promoRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plbProgram" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cycleType" TEXT NOT NULL,
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "metricDefinitions" JSONB NOT NULL,
    "slabDefinitions" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plbProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plbMetric" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "metricName" TEXT NOT NULL,
    "metricValue" DECIMAL(18,6) NOT NULL,
    "targetValue" DECIMAL(18,6) NOT NULL,
    "achievementPct" DECIMAL(5,2) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plbMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plbBonus" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "slabName" TEXT,
    "incentiveType" TEXT NOT NULL,
    "incentiveValue" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "payoutRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plbBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchangeAgreement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "conversionRatio" DECIMAL(10,6) NOT NULL,
    "minAmount" INTEGER,
    "maxAmount" INTEGER,
    "dailyCap" INTEGER,
    "monthlyCap" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trustModel" TEXT NOT NULL DEFAULT 'BILATERAL',
    "settlementModel" TEXT NOT NULL DEFAULT 'REAL_TIME',
    "breakageOwner" TEXT NOT NULL DEFAULT 'ISSUER',
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchangeAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "exchangeOrder" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "sourceCustomerId" TEXT NOT NULL,
    "targetCustomerId" TEXT,
    "sourceAmount" INTEGER NOT NULL,
    "targetAmount" INTEGER NOT NULL,
    "conversionRate" DECIMAL(10,6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reversalReason" TEXT,
    "reversedAt" TIMESTAMP(3),
    "referenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchangeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchangeAuditLog" (
    "id" TEXT NOT NULL,
    "exchangeOrderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchangeAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_phoneNumber_key" ON "organization"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "organization_username_key" ON "organization"("username");

-- CreateIndex
CREATE INDEX "organization_phoneNumber_idx" ON "organization"("phoneNumber");

-- CreateIndex
CREATE INDEX "organization_countryCode_idx" ON "organization"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "metaFlagsForOrganization_organizationId_key" ON "metaFlagsForOrganization"("organizationId");

-- CreateIndex
CREATE INDEX "customer_phoneNumber_idx" ON "customer"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "customer_organizationId_phoneNumber_key" ON "customer"("organizationId", "phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "customer_organizationId_externalId_key" ON "customer"("organizationId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "metaFlagsForCustomer_customerId_key" ON "metaFlagsForCustomer"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "organizationApiKey_prefix_key" ON "organizationApiKey"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "organizationApiKey_keyHash_key" ON "organizationApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "organizationApiKey_organizationId_isActive_idx" ON "organizationApiKey"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "organization_campaign_idx" ON "organizationCampaign"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organizationCampaign_organizationId_name_key" ON "organizationCampaign"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "currency_organizationId_code_key" ON "currency"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "exchangeRate_currencyId_physicalCurrencyCode_key" ON "exchangeRate"("currencyId", "physicalCurrencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "currencyBucket_organizationId_code_key" ON "currencyBucket"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "organizationOrder_paymentReference_key" ON "organizationOrder"("paymentReference");

-- CreateIndex
CREATE INDEX "organizationOrder_organizationId_orderStatus_idx" ON "organizationOrder"("organizationId", "orderStatus");

-- CreateIndex
CREATE UNIQUE INDEX "orderDetail_organizationOrderId_key" ON "orderDetail"("organizationOrderId");

-- CreateIndex
CREATE INDEX "customerWallet_customerId_idx" ON "customerWallet"("customerId");

-- CreateIndex
CREATE INDEX "customerWallet_organizationId_idx" ON "customerWallet"("organizationId");

-- CreateIndex
CREATE INDEX "customerWallet_currencyCode_idx" ON "customerWallet"("currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "customerWallet_customerId_organizationId_currencyCode_key" ON "customerWallet"("customerId", "organizationId", "currencyCode");

-- CreateIndex
CREATE INDEX "customerWalletPocket_customerWalletId_idx" ON "customerWalletPocket"("customerWalletId");

-- CreateIndex
CREATE INDEX "customerWalletPocketTransaction_customerWalletPocketId_idx" ON "customerWalletPocketTransaction"("customerWalletPocketId");

-- CreateIndex
CREATE UNIQUE INDEX "customerWalletPocketTransaction_customerWalletPocketId_tran_key" ON "customerWalletPocketTransaction"("customerWalletPocketId", "transactionRef");

-- CreateIndex
CREATE UNIQUE INDEX "couponCode_code_key" ON "couponCode"("code");

-- CreateIndex
CREATE INDEX "couponCode_code_idx" ON "couponCode"("code");

-- CreateIndex
CREATE INDEX "couponCode_programId_customerId_idx" ON "couponCode"("programId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "rewardBlock_blockId_key" ON "rewardBlock"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "rewardLedger_idempotencyKey_key" ON "rewardLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "rewardLedger_couponCodeId_idx" ON "rewardLedger"("couponCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_programId_key" ON "budget"("programId");

-- CreateIndex
CREATE INDEX "auditLog_entityType_entityId_idx" ON "auditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "auditLog_action_idx" ON "auditLog"("action");

-- CreateIndex
CREATE INDEX "auditLog_createdAt_idx" ON "auditLog"("createdAt");

-- CreateIndex
CREATE INDEX "customerOrganizationOrder_customerId_idx" ON "customerOrganizationOrder"("customerId");

-- CreateIndex
CREATE INDEX "customerOrganizationOrder_organizationId_idx" ON "customerOrganizationOrder"("organizationId");

-- CreateIndex
CREATE INDEX "customerOrganizationOrder_status_idx" ON "customerOrganizationOrder"("status");

-- CreateIndex
CREATE INDEX "customerOrganizationOrder_createdAt_idx" ON "customerOrganizationOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "customerOrganizationOrder_customerId_idempotencyKey_key" ON "customerOrganizationOrder"("customerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "customerEarningAmountDetail_customerOrganizationOrderId_key" ON "customerEarningAmountDetail"("customerOrganizationOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "customerBurningAmountDetail_customerOrganizationOrderId_key" ON "customerBurningAmountDetail"("customerOrganizationOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "burningCashAmountDetail_customerBurningAmountDetailId_key" ON "burningCashAmountDetail"("customerBurningAmountDetailId");

-- CreateIndex
CREATE UNIQUE INDEX "burningCoinAmountDetail_customerBurningAmountDetailId_key" ON "burningCoinAmountDetail"("customerBurningAmountDetailId");

-- CreateIndex
CREATE UNIQUE INDEX "invite_assignedTo_key" ON "invite"("assignedTo");

-- CreateIndex
CREATE UNIQUE INDEX "interest_phoneNumber_key" ON "interest"("phoneNumber");

-- CreateIndex
CREATE INDEX "exchangeRateHistory_currencyId_physicalCurrencyCode_idx" ON "exchangeRateHistory"("currencyId", "physicalCurrencyCode");

-- CreateIndex
CREATE INDEX "exchangeRateHistory_currencyId_physicalCurrencyCode_lockedU_idx" ON "exchangeRateHistory"("currencyId", "physicalCurrencyCode", "lockedUntil");

-- CreateIndex
CREATE INDEX "exchangeRateHistory_createdAt_idx" ON "exchangeRateHistory"("createdAt");

-- CreateIndex
CREATE INDEX "fxAuditRecord_referenceId_idx" ON "fxAuditRecord"("referenceId");

-- CreateIndex
CREATE INDEX "fxAuditRecord_tenantId_idx" ON "fxAuditRecord"("tenantId");

-- CreateIndex
CREATE INDEX "fxAuditRecord_createdAt_idx" ON "fxAuditRecord"("createdAt");

-- CreateIndex
CREATE INDEX "loyaltyTier_organizationId_idx" ON "loyaltyTier"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "loyaltyTier_organizationId_name_key" ON "loyaltyTier"("organizationId", "name");

-- CreateIndex
CREATE INDEX "customerTier_customerId_idx" ON "customerTier"("customerId");

-- CreateIndex
CREATE INDEX "customerTier_organizationId_idx" ON "customerTier"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "customerTier_customerId_organizationId_key" ON "customerTier"("customerId", "organizationId");

-- CreateIndex
CREATE INDEX "loyaltyStatement_customerId_organizationId_idx" ON "loyaltyStatement"("customerId", "organizationId");

-- CreateIndex
CREATE INDEX "loyaltyStatement_periodEnd_idx" ON "loyaltyStatement"("periodEnd");

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

-- CreateIndex
CREATE INDEX "loyaltyWebhookEndpoint_organizationId_isActive_idx" ON "loyaltyWebhookEndpoint"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "loyaltyWebhookDelivery_status_nextAttemptAt_idx" ON "loyaltyWebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "loyaltyWebhookDelivery_organizationId_createdAt_idx" ON "loyaltyWebhookDelivery"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "loyaltyWebhookDelivery_endpointId_outboxEventId_key" ON "loyaltyWebhookDelivery"("endpointId", "outboxEventId");

-- CreateIndex
CREATE UNIQUE INDEX "promoCode_code_key" ON "promoCode"("code");

-- CreateIndex
CREATE INDEX "promoCode_organizationId_idx" ON "promoCode"("organizationId");

-- CreateIndex
CREATE INDEX "promoCode_code_idx" ON "promoCode"("code");

-- CreateIndex
CREATE INDEX "promoRedemption_promoCodeId_idx" ON "promoRedemption"("promoCodeId");

-- CreateIndex
CREATE INDEX "promoRedemption_customerId_idx" ON "promoRedemption"("customerId");

-- CreateIndex
CREATE INDEX "promoRedemption_organizationId_idx" ON "promoRedemption"("organizationId");

-- CreateIndex
CREATE INDEX "plbProgram_organizationId_idx" ON "plbProgram"("organizationId");

-- CreateIndex
CREATE INDEX "plbProgram_status_idx" ON "plbProgram"("status");

-- CreateIndex
CREATE INDEX "plbMetric_programId_entityId_idx" ON "plbMetric"("programId", "entityId");

-- CreateIndex
CREATE INDEX "plbMetric_periodEnd_idx" ON "plbMetric"("periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "plbMetric_programId_entityId_periodStart_periodEnd_metricNa_key" ON "plbMetric"("programId", "entityId", "periodStart", "periodEnd", "metricName");

-- CreateIndex
CREATE INDEX "plbBonus_programId_entityId_idx" ON "plbBonus"("programId", "entityId");

-- CreateIndex
CREATE INDEX "plbBonus_status_idx" ON "plbBonus"("status");

-- CreateIndex
CREATE UNIQUE INDEX "plbBonus_programId_entityId_cycleStart_cycleEnd_key" ON "plbBonus"("programId", "entityId", "cycleStart", "cycleEnd");

-- CreateIndex
CREATE INDEX "exchangeAgreement_sourceEntityId_idx" ON "exchangeAgreement"("sourceEntityId");

-- CreateIndex
CREATE INDEX "exchangeAgreement_targetEntityId_idx" ON "exchangeAgreement"("targetEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "exchangeAgreement_sourceEntityId_targetEntityId_sourceCurre_key" ON "exchangeAgreement"("sourceEntityId", "targetEntityId", "sourceCurrency", "targetCurrency");

-- CreateIndex
CREATE INDEX "exchangeQuote_sourceEntityId_sourceCustomerId_idx" ON "exchangeQuote"("sourceEntityId", "sourceCustomerId");

-- CreateIndex
CREATE INDEX "exchangeQuote_expiresAt_idx" ON "exchangeQuote"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "exchangeOrder_referenceId_key" ON "exchangeOrder"("referenceId");

-- CreateIndex
CREATE INDEX "exchangeOrder_agreementId_idx" ON "exchangeOrder"("agreementId");

-- CreateIndex
CREATE INDEX "exchangeOrder_sourceCustomerId_idx" ON "exchangeOrder"("sourceCustomerId");

-- CreateIndex
CREATE INDEX "exchangeOrder_targetCustomerId_idx" ON "exchangeOrder"("targetCustomerId");

-- CreateIndex
CREATE INDEX "exchangeOrder_status_idx" ON "exchangeOrder"("status");

-- CreateIndex
CREATE INDEX "exchangeAuditLog_exchangeOrderId_idx" ON "exchangeAuditLog"("exchangeOrderId");

-- AddForeignKey
ALTER TABLE "metaFlagsForOrganization" ADD CONSTRAINT "metaFlagsForOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metaFlagsForCustomer" ADD CONSTRAINT "metaFlagsForCustomer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizationApiKey" ADD CONSTRAINT "organizationApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizationCampaign" ADD CONSTRAINT "organizationCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency" ADD CONSTRAINT "currency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchangeRate" ADD CONSTRAINT "exchangeRate_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currencyBucket" ADD CONSTRAINT "currencyBucket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currencyBucketTransaction" ADD CONSTRAINT "currencyBucketTransaction_currencyBucketId_fkey" FOREIGN KEY ("currencyBucketId") REFERENCES "currencyBucket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizationOrder" ADD CONSTRAINT "organizationOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizationOrderStatusHistory" ADD CONSTRAINT "organizationOrderStatusHistory_organizationOrderId_fkey" FOREIGN KEY ("organizationOrderId") REFERENCES "organizationOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orderDetail" ADD CONSTRAINT "orderDetail_organizationOrderId_fkey" FOREIGN KEY ("organizationOrderId") REFERENCES "organizationOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customerWallet" ADD CONSTRAINT "customerWallet_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customerWalletPocket" ADD CONSTRAINT "customerWalletPocket_customerWalletId_fkey" FOREIGN KEY ("customerWalletId") REFERENCES "customerWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customerWalletPocketTransaction" ADD CONSTRAINT "customerWalletPocketTransaction_customerWalletPocketId_fkey" FOREIGN KEY ("customerWalletPocketId") REFERENCES "customerWalletPocket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewardProgram" ADD CONSTRAINT "rewardProgram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewardProgramRule" ADD CONSTRAINT "rewardProgramRule_programId_fkey" FOREIGN KEY ("programId") REFERENCES "rewardProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couponCode" ADD CONSTRAINT "couponCode_programId_fkey" FOREIGN KEY ("programId") REFERENCES "rewardProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couponCode" ADD CONSTRAINT "couponCode_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewardBlock" ADD CONSTRAINT "rewardBlock_programId_fkey" FOREIGN KEY ("programId") REFERENCES "rewardProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewardBlock" ADD CONSTRAINT "rewardBlock_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewardLedger" ADD CONSTRAINT "rewardLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewardLedger" ADD CONSTRAINT "rewardLedger_programId_fkey" FOREIGN KEY ("programId") REFERENCES "rewardProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewardLedger" ADD CONSTRAINT "rewardLedger_couponCodeId_fkey" FOREIGN KEY ("couponCodeId") REFERENCES "couponCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_programId_fkey" FOREIGN KEY ("programId") REFERENCES "rewardProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customerOrganizationOrder" ADD CONSTRAINT "customerOrganizationOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customerOrganizationOrder" ADD CONSTRAINT "customerOrganizationOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customerEarningAmountDetail" ADD CONSTRAINT "customerEarningAmountDetail_customerOrganizationOrderId_fkey" FOREIGN KEY ("customerOrganizationOrderId") REFERENCES "customerOrganizationOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customerBurningAmountDetail" ADD CONSTRAINT "customerBurningAmountDetail_customerOrganizationOrderId_fkey" FOREIGN KEY ("customerOrganizationOrderId") REFERENCES "customerOrganizationOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "burningCashAmountDetail" ADD CONSTRAINT "burningCashAmountDetail_customerBurningAmountDetailId_fkey" FOREIGN KEY ("customerBurningAmountDetailId") REFERENCES "customerBurningAmountDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earningCoinAmountDetail" ADD CONSTRAINT "earningCoinAmountDetail_customerEarningAmountDetailId_fkey" FOREIGN KEY ("customerEarningAmountDetailId") REFERENCES "customerEarningAmountDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earningCoinAmountDetail" ADD CONSTRAINT "earningCoinAmountDetail_organizationCampaignId_fkey" FOREIGN KEY ("organizationCampaignId") REFERENCES "organizationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "burningCoinAmountDetail" ADD CONSTRAINT "burningCoinAmountDetail_customerBurningAmountDetailId_fkey" FOREIGN KEY ("customerBurningAmountDetailId") REFERENCES "customerBurningAmountDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customerOrganizationOrderStatusHistory" ADD CONSTRAINT "customerOrganizationOrderStatusHistory_customerOrganizatio_fkey" FOREIGN KEY ("customerOrganizationOrderId") REFERENCES "customerOrganizationOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customerTier" ADD CONSTRAINT "customerTier_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "loyaltyTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyaltyWebhookDelivery" ADD CONSTRAINT "loyaltyWebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "loyaltyWebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoRedemption" ADD CONSTRAINT "promoRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

