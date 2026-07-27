-- CreateEnum
CREATE TYPE "PointTypes" AS ENUM ('AVAILABLE', 'BLOCKED', 'PENDING');

-- CreateEnum
CREATE TYPE "EarningExpiresIn" AS ENUM ('ONE_MONTH', 'TWO_MONTHS', 'THREE_MONTHS');

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

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "kycStatus" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "OrganizationRoles" NOT NULL DEFAULT 'ADMIN',
    "orgAdminId" TEXT,
    "fcmToken" TEXT,
    "address" TEXT,
    "logoUrl" TEXT,
    "upiQrCodeUrl" TEXT,

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
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fcmToken" TEXT,

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
    "earningExpiresIn" "EarningExpiresIn" NOT NULL DEFAULT 'ONE_MONTH',

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
CREATE TABLE "customerOrganizationOrder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "physicalCurrency" TEXT NOT NULL,
    "status" "CustomerOrganizationOrderStatus" NOT NULL,
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
    "earningExpiresIn" "EarningExpiresIn" NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "organization_phoneNumber_key" ON "organization"("phoneNumber");

-- CreateIndex
CREATE INDEX "organization_phoneNumber_idx" ON "organization"("phoneNumber");

-- CreateIndex
CREATE INDEX "organization_countryCode_idx" ON "organization"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "metaFlagsForOrganization_organizationId_key" ON "metaFlagsForOrganization"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_phoneNumber_key" ON "customer"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "metaFlagsForCustomer_customerId_key" ON "metaFlagsForCustomer"("customerId");

-- CreateIndex
CREATE INDEX "organization_campaign_idx" ON "organizationCampaign"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organizationCampaign_organizationId_name_key" ON "organizationCampaign"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "currency_code_key" ON "currency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "exchangeRate_currencyId_physicalCurrencyCode_key" ON "exchangeRate"("currencyId", "physicalCurrencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "currencyBucket_organizationId_code_key" ON "currencyBucket"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "orderDetail_organizationOrderId_key" ON "orderDetail"("organizationOrderId");

-- CreateIndex
CREATE INDEX "customerWallet_customerId_idx" ON "customerWallet"("customerId");

-- CreateIndex
CREATE INDEX "customerWallet_currencyCode_idx" ON "customerWallet"("currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "customerWallet_customerId_currencyCode_key" ON "customerWallet"("customerId", "currencyCode");

-- CreateIndex
CREATE INDEX "customerWalletPocket_customerWalletId_idx" ON "customerWalletPocket"("customerWalletId");

-- CreateIndex
CREATE INDEX "customerWalletPocketTransaction_customerWalletPocketId_idx" ON "customerWalletPocketTransaction"("customerWalletPocketId");

-- CreateIndex
CREATE INDEX "customerOrganizationOrder_customerId_idx" ON "customerOrganizationOrder"("customerId");

-- CreateIndex
CREATE INDEX "customerOrganizationOrder_organizationId_idx" ON "customerOrganizationOrder"("organizationId");

-- CreateIndex
CREATE INDEX "customerOrganizationOrder_status_idx" ON "customerOrganizationOrder"("status");

-- CreateIndex
CREATE INDEX "customerOrganizationOrder_createdAt_idx" ON "customerOrganizationOrder"("createdAt");

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

-- AddForeignKey
ALTER TABLE "metaFlagsForOrganization" ADD CONSTRAINT "metaFlagsForOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metaFlagsForCustomer" ADD CONSTRAINT "metaFlagsForCustomer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

