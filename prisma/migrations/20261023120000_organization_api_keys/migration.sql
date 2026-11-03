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

-- CreateIndex
CREATE UNIQUE INDEX "organizationApiKey_prefix_key" ON "organizationApiKey"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "organizationApiKey_keyHash_key" ON "organizationApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "organizationApiKey_organizationId_isActive_idx" ON "organizationApiKey"("organizationId", "isActive");

-- AddForeignKey
ALTER TABLE "organizationApiKey" ADD CONSTRAINT "organizationApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
