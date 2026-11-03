# Legacy migrations (archived)

These are the original incremental migrations, kept for reference only.
**Prisma does not read this directory** - only `prisma/migrations/` is applied.

They were archived because the chain was incomplete: `0_init` plus the six
follow-up migrations created only 31 of the 51 tables in `prisma/schema.prisma`.
Twenty tables were added to the schema over time and only ever synced with
`prisma db push`, so a fresh `prisma migrate deploy` failed at
`20261024120000_hardening_round2` with:

```
ERROR: relation "exchangeRateHistory" does not exist  (42P01)
```

They are replaced by the single squashed baseline `prisma/migrations/0_init_full`.

## Data changes that the baseline does NOT include

The baseline only creates schema objects. The archived migrations also ran
one-off data steps that are not replayed on a fresh database (harmless when the
database is empty, but important if you baseline a database that already has
data). Re-apply the relevant statements manually before baselining:

- `20261024120000_hardening_round2`
  - backfill `customerWallet."organizationId"` from `currency."organizationId"`
    and delete wallets that cannot be attributed to an organization
  - de-duplicate `customerWalletPocketTransaction` / `plbMetric` / `plbBonus`
    rows so the new unique indexes can be created
- `20261026120000_customer_tenant_scoping`
  - backfill `customer."organizationId"` from existing order/wallet relations

For an empty database (the common case) none of this is required.
