# JobScheduler Module (PostgreSQL-backed)

The JobScheduler module handles asynchronous job processing for the loyalty platform. It is the
replacement for the legacy MongoDB-backed **Agenda** setup: jobs are now persisted in the **same
PostgreSQL database** used by the application, in the `pgboss` schema, and are consumed by
in-process workers. This removes MongoDB from the runtime entirely.

## Why this changed

Previously the app ran an extra datastore (MongoDB) purely to keep Agenda's job collection. Every
environment therefore needed 3 services (Postgres, Redis, MongoDB) instead of 2. By moving jobs onto
Postgres we:

- remove a whole datastore (less infra, one consistent backup story)
- keep the job table inside the same transactional database as the business data
- rely on PostgreSQL's reliability and rich feature set (JSONB payloads, partitioned tables)

## How it works

- **Scheduler**: `JobSchedulerService` wraps **[pg-boss](https://github.com/timgit/pg-boss)**.
  On `onModuleInit` it builds a `PgBoss` instance from `LSB_PG_URL` (the same URL Prisma uses) and
  calls `boss.start()`, which creates/migrates the `pgboss` schema in PostgreSQL.
- **Producer**: `scheduleJob()` calls `boss.send(name, data, { startAfter, singletonKey, retry... })`
  and returns the pg-boss job id in `job.attrs._id` so existing producer code keeps working.
- **Consumer**: `defineJob()` calls `boss.work(name, { batchSize: 1, ... }, handler)`. Fetched jobs
  are wrapped into the legacy `{ attrs: { _id, name, data } }` shape before calling the processor.
- **Cancel / reschedule**: `cancelJobs()` and `updateJobNextRunAt()` update the `pgboss.job`
  partitioning-enabled table directly via parameterised SQL through `boss.getDb().executeSql()`
  (pg-boss's own connection), translating the old agenda query shapes
  (`{ name }`, `{ _id }`, `{ name, 'data.<field>': value }`).

## Available API

| Method | Purpose |
|---|---|
| `defineJob({ name, processor, options })` | Register a worker for a queue |
| `scheduleJob({ name, data, uniqueJobId, when })` | Queue a one-shot job (singleton when `uniqueJobId` is set) |
| `createRecurringJob({ name, data, interval, options })` | Cron-recurring job via pg-boss `schedule` |
| `cancelJobs({ query })` | Cancel queued/active jobs by id, name and/or payload field |
| `updateJobNextRunAt(jobId, nextRunAt)` | Reschedule a pending job |
| `stop()` | Gracefully stop workers |

## Concept

**Database-backed job queues**: durable queues store work items in the database rather than in
memory. This gives at-least-once semantics, crash recovery and observability out of the box, because
the queue state row is updated under the same database transaction machinery as regular data.
PostgreSQL is well suited for this: its advisory locks / `FOR UPDATE SKIP LOCKED` fetch idiom allows
multiple worker instances to claim jobs without double-processing. pg-boss also partitions the job
table by queue name so high-throughput queues stay fast.

## Implementation Principles applied

- **Adapter pattern** — `JobSchedulerService` exposes the same shape the legacy Agenda service did
  (`ScheduleJobParams`, `JobResult.job.attrs._id`, processor `(job) => job.attrs.data`), so the
  producers/consumers did not change their business logic (only imports). The pg-boss dependency is
  isolated behind this facade (job-scheduler.service.ts:104).
- **Strategy / pluggable scheduler** — swapping the scheduling backend (Agenda/Mongo → pg-boss/Postgres)
  is a configuration detail of the facade, not a change to every call-site.
- **Dependency inversion** — the module provides and exports `JobSchedulerService`; consuming modules
  import `JobSchedulerModule` instead of instantiating a scheduler themselves.
- **Transactional safety** — cancels and reschedules use parameterised SQL against the action-able
  job states (`created | retry | active`), preserving pg-boss's own state machine.

## Queue table

```
pgboss.job  (partitioned by LIST(name))
  id uuid PK default gen_random_uuid()
  name text            -- queue name
  data jsonb           -- user payload
  state job_state      -- created | retry | active | completed | cancelled | failed
  start_after timestamptz
  retry_limit int, retry_count int, retry_delay int, retry_backoff bool
  expire_seconds int, deletion_seconds int
  singleton_key text, singleton_on timestamptz
  created_on / started_on / completed_on timestamptz
  output jsonb, dead_letter text
  ...
```

## Job Enumerations

`LongListEnumOfAgendaJobs` in `src/common/enums/jobs.ts` still enumerates the queue names:

| Env / constant | Queue name |
|---|---|
| `ADD_NEW_CURRENCY_BUCKET_TO_ORG` | `addNewCurrencyBucketToOrg` |
| `HANDLE_ONE_STEP_CREDIT_POINTS` | `handleOneStepCreditPoints` |
| `HANDLE_BLOCKING_CUSTOMER_POINTS` | `handleBlockingCustomerPoints` |
| `HANDLE_DEBITING_BLOCKED_POINTS` | `handleDebitingBlockedPoints` |
| `INITIALIZE_CUSTOMER_POINTS` | `initializeCustomerPoints` |
| `HANDLE_CUSTOMER_ORGANIZATION_ORDER_COMPLETING` | `handleCustomerOrganizationOrderCompleting` |
| `HANDLE_FULFILL_POINTS_EXPIRY` | `handleFulfillPointsExpiry` |
| `HANDLE_BLOCK_POINTS_UNBLOCKING` | `handleBlockPointsUnblocking` |
| `CAMPAIGN_EXPIRY_REMINDER` | `campaignExpiryReminder` |

## Resources

- https://github.com/timgit/pg-boss — library docs (send/work/schedule/cancel, retry, scheduler)
- https://www.postgresql.org/docs/current/ddl-partitioning.html — declarative partitioning used by the job table
- https://www.2ndquadrant.com/en/blog/what-is-select-skip-locked-for-in-postgresql-9-5/ — SKIP LOCKED pattern behind durable queues