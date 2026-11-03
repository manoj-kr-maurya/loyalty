-- ─── Tenant credentials for organization staff ──────────────────────────────
-- Staff authenticate with a username + password, then prove possession of the
-- registered mobile number with an OTP. The columns stay nullable so tenants
-- that predate credential login can be migrated in on their first login.
ALTER TABLE "organization" ADD COLUMN "username" TEXT;
ALTER TABLE "organization" ADD COLUMN "passwordHash" TEXT;
CREATE UNIQUE INDEX "organization_username_key" ON "organization"("username");

-- ─── Customers become tenant scoped ─────────────────────────────────────────
-- A shopper identity belongs to exactly one tenant. The same phone number at
-- two tenants is two different customers. The global unique constraint on
-- phoneNumber is replaced by a per-tenant one.
DROP INDEX IF EXISTS "customer_phoneNumber_key";
CREATE INDEX "customer_phoneNumber_idx" ON "customer"("phoneNumber");
ALTER TABLE "customer" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "customer" ADD COLUMN "externalId" TEXT;

-- Every tenant a customer is known to, derived from the records that already
-- carry a tenant dimension. Coupon/reward rows inherit their tenant from the
-- reward program they belong to.
DROP TABLE IF EXISTS _customer_orgs;
CREATE TEMP TABLE _customer_orgs AS
SELECT DISTINCT "customerId" AS cid, "organizationId" AS oid FROM (
    SELECT "customerId", "organizationId" FROM "customerWallet" WHERE "organizationId" IS NOT NULL
    UNION
    SELECT "customerId", "organizationId" FROM "customerOrganizationOrder" WHERE "organizationId" IS NOT NULL
    UNION
    SELECT cc."customerId", rp."organizationId" FROM "couponCode" cc JOIN "rewardProgram" rp ON rp.id = cc."programId" WHERE cc."customerId" IS NOT NULL
    UNION
    SELECT rb."customerId", rp."organizationId" FROM "rewardBlock" rb JOIN "rewardProgram" rp ON rp.id = rb."programId"
    UNION
    SELECT rl."customerId", rp."organizationId" FROM "rewardLedger" rl JOIN "rewardProgram" rp ON rp.id = rl."programId"
    UNION
    SELECT "customerId", "organizationId" FROM "customerTier"
    UNION
    SELECT "customerId", "organizationId" FROM "loyaltyStatement"
    UNION
    SELECT "customerId", "organizationId" FROM "loyaltyLedgerEntry"
    UNION
    SELECT "customerId", "organizationId" FROM "promoRedemption"
    UNION
    SELECT "customerId", "organizationId" FROM "loyaltyIdempotency" WHERE "customerId" IS NOT NULL
) orgs;

-- Map each (customer, tenant) pair to the customer row that will own it.
-- The customer keeps its original id for its primary tenant; an extra row is
-- created for every other tenant it was also known to.
DROP TABLE IF EXISTS _customer_org_map;
CREATE TEMP TABLE _customer_org_map (
    cid       TEXT NOT NULL,
    oid       TEXT NOT NULL,
    new_cid   TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (cid, oid)
);

DO $$
DECLARE
    cust            RECORD;
    org_row         RECORD;
    new_customer_id TEXT;
    primary_org     TEXT;
BEGIN
    FOR cust IN
        SELECT c.id, c.name, c."phoneNumber", c."countryCode", c."isVerified",
               c."createdAt", c."updatedAt", c."fcmToken", c."logoUrl"
        FROM "customer" c
        WHERE EXISTS (SELECT 1 FROM _customer_orgs o WHERE o.cid = c.id)
    LOOP
        -- The primary tenant is the one with the most recent order, then the
        -- most recently touched wallet, then a stable tie-break.
        SELECT o.oid INTO primary_org
        FROM _customer_orgs o
        WHERE o.cid = cust.id
        ORDER BY (
            SELECT MAX(o2."createdAt") FROM "customerOrganizationOrder" o2
            WHERE o2."customerId" = cust.id AND o2."organizationId" = o.oid
        ) DESC NULLS LAST,
        (
            SELECT MAX(w2."updatedAt") FROM "customerWallet" w2
            WHERE w2."customerId" = cust.id AND w2."organizationId" = o.oid
        ) DESC NULLS LAST,
        o.oid
        LIMIT 1;

        INSERT INTO _customer_org_map (cid, oid, new_cid, is_primary)
        VALUES (cust.id, primary_org, cust.id, TRUE);

        FOR org_row IN
            SELECT o.oid FROM _customer_orgs o
            WHERE o.cid = cust.id AND o.oid <> primary_org
        LOOP
            new_customer_id := gen_random_uuid()::text;

            INSERT INTO "customer" (
                id, name, "phoneNumber", "countryCode", "isVerified", token,
                "createdAt", "updatedAt", "fcmToken", "logoUrl", "organizationId"
            ) VALUES (
                new_customer_id, cust.name, cust."phoneNumber", cust."countryCode",
                cust."isVerified", '', cust."createdAt", cust."updatedAt",
                cust."fcmToken", cust."logoUrl", org_row.oid
            );

            INSERT INTO "metaFlagsForCustomer" ("id", "initJourneyCompleted", "customerId")
            SELECT gen_random_uuid()::text, mf."initJourneyCompleted", new_customer_id
            FROM "metaFlagsForCustomer" mf
            WHERE mf."customerId" = cust.id;

            INSERT INTO _customer_org_map (cid, oid, new_cid, is_primary)
            VALUES (cust.id, org_row.oid, new_customer_id, FALSE);
        END LOOP;
    END LOOP;
END $$;

-- Re-point every tenant-scoped record at the customer row of its own tenant.
UPDATE "customerWallet" w
SET "customerId" = m.new_cid
FROM _customer_org_map m
WHERE w."customerId" = m.cid AND w."organizationId" = m.oid AND m.is_primary = FALSE;

UPDATE "customerOrganizationOrder" o
SET "customerId" = m.new_cid
FROM _customer_org_map m
WHERE o."customerId" = m.cid AND o."organizationId" = m.oid AND m.is_primary = FALSE;

UPDATE "customerTier" t
SET "customerId" = m.new_cid
FROM _customer_org_map m
WHERE t."customerId" = m.cid AND t."organizationId" = m.oid AND m.is_primary = FALSE;

UPDATE "loyaltyStatement" s
SET "customerId" = m.new_cid
FROM _customer_org_map m
WHERE s."customerId" = m.cid AND s."organizationId" = m.oid AND m.is_primary = FALSE;

UPDATE "loyaltyLedgerEntry" l
SET "customerId" = m.new_cid
FROM _customer_org_map m
WHERE l."customerId" = m.cid AND l."organizationId" = m.oid AND m.is_primary = FALSE;

UPDATE "promoRedemption" p
SET "customerId" = m.new_cid
FROM _customer_org_map m
WHERE p."customerId" = m.cid AND p."organizationId" = m.oid AND m.is_primary = FALSE;

UPDATE "loyaltyIdempotency" i
SET "customerId" = m.new_cid
FROM _customer_org_map m
WHERE i."customerId" = m.cid AND i."organizationId" = m.oid AND m.is_primary = FALSE;

UPDATE "couponCode" cc
SET "customerId" = m.new_cid
FROM "rewardProgram" rp, _customer_org_map m
WHERE cc."programId" = rp.id AND rp."organizationId" = m.oid
  AND cc."customerId" = m.cid AND m.is_primary = FALSE;

UPDATE "rewardBlock" rb
SET "customerId" = m.new_cid
FROM "rewardProgram" rp, _customer_org_map m
WHERE rb."programId" = rp.id AND rp."organizationId" = m.oid
  AND rb."customerId" = m.cid AND m.is_primary = FALSE;

UPDATE "rewardLedger" rl
SET "customerId" = m.new_cid
FROM "rewardProgram" rp, _customer_org_map m
WHERE rl."programId" = rp.id AND rp."organizationId" = m.oid
  AND rl."customerId" = m.cid AND m.is_primary = FALSE;

-- Assign the tenant to the customer rows.
UPDATE "customer" c
SET "organizationId" = m.oid
FROM _customer_org_map m
WHERE c.id = m.new_cid;

-- Customers that were never known to any tenant cannot exist in a tenant
-- scoped model: they were rows created through the public shopper OTP flow
-- and hold no wallet, order, reward or ledger record. Remove them.
DELETE FROM "metaFlagsForCustomer" mf
WHERE mf."customerId" IN (
    SELECT c.id FROM "customer" c
    WHERE NOT EXISTS (SELECT 1 FROM _customer_org_map m WHERE m.new_cid = c.id)
      AND NOT EXISTS (SELECT 1 FROM "couponCode" cc WHERE cc."customerId" = c.id)
      AND NOT EXISTS (SELECT 1 FROM "rewardBlock" rb WHERE rb."customerId" = c.id)
      AND NOT EXISTS (SELECT 1 FROM "rewardLedger" rl WHERE rl."customerId" = c.id)
      AND NOT EXISTS (SELECT 1 FROM "loyaltyIdempotency" li WHERE li."customerId" = c.id)
);

DELETE FROM "customer" c
WHERE NOT EXISTS (SELECT 1 FROM _customer_org_map m WHERE m.new_cid = c.id)
  AND NOT EXISTS (SELECT 1 FROM "couponCode" cc WHERE cc."customerId" = c.id)
  AND NOT EXISTS (SELECT 1 FROM "rewardBlock" rb WHERE rb."customerId" = c.id)
  AND NOT EXISTS (SELECT 1 FROM "rewardLedger" rl WHERE rl."customerId" = c.id)
  AND NOT EXISTS (SELECT 1 FROM "loyaltyIdempotency" li WHERE li."customerId" = c.id);

ALTER TABLE "customer" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "customer"
    ADD CONSTRAINT "customer_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "organization_id_customer_phone_number"
    ON "customer"("organizationId", "phoneNumber");
CREATE UNIQUE INDEX "organization_id_customer_external_id"
    ON "customer"("organizationId", "externalId");

DROP TABLE IF EXISTS _customer_org_map;
DROP TABLE IF EXISTS _customer_orgs;
