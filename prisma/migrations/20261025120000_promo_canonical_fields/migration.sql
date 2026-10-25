-- Add engine promo fields to the canonical RewardProgram model.
ALTER TABLE "rewardProgram" ADD COLUMN "discountType" TEXT;
ALTER TABLE "rewardProgram" ADD COLUMN "isStackable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "rewardProgram" ADD COLUMN "applicableProducts" JSONB;

-- Allow unlimited coupon usage and preserve code-level per-user limits.
ALTER TABLE "couponCode" ALTER COLUMN "maxUses" DROP NOT NULL;
ALTER TABLE "couponCode" ADD COLUMN "perUserLimit" INTEGER;

-- Link coupon redemptions to the canonical ledger and make retries idempotent.
ALTER TABLE "rewardLedger" ADD COLUMN "couponCodeId" TEXT;
ALTER TABLE "rewardLedger" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "rewardLedger_idempotencyKey_key" ON "rewardLedger"("idempotencyKey");
CREATE INDEX "rewardLedger_couponCodeId_idx" ON "rewardLedger"("couponCodeId");
ALTER TABLE "rewardLedger"
  ADD CONSTRAINT "rewardLedger_couponCodeId_fkey"
  FOREIGN KEY ("couponCodeId") REFERENCES "couponCode"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
