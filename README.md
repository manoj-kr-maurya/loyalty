# Loyalty Engine Microservice

A comprehensive loyalty program management backend service built with NestJS, offering features for organizations to create and manage loyalty campaigns, handle digital currency transactions, and manage customer rewards.

## Tech Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL (with Prisma ORM)
- **Caching**: Redis
- **Message Queue**: RabbitMQ
- **Job Scheduling**: pg-boss (PostgreSQL-backed)
- **Monitoring & Observability**:
  - Prometheus
  - Grafana + Loki
  - Node Exporter
- **Containerization**: Docker
- **CI/CD**: GitHub Actions

## High-Level Schema

The system manages several key entities:

- **Organizations**: Businesses that create loyalty programs

  - Can have multiple currencies and campaigns
  - Supports different roles (ADMIN, SHOP)
  - Manages their own loyalty currency buckets

- **Customers**: End-users who earn and spend loyalty points

  - Have wallets for different currencies
  - Track transaction history
  - Manage loyalty point balances

- **Campaigns**: Loyalty programs created by organizations

  - Define earning percentages
  - Set expiry rules
  - Support multiple currencies

- **Wallets & Transactions**:
  - Support multiple currency types
  - Track available, blocked, pending, used, and expired balances
  - Maintain transaction history
  - Support auto top-up functionality

## Cloud Architecture

- **Environment Setup**:
  - 3 environments: stage, prod
  - Each environment has 2 servers on Oracle Cloud:
    - Primary application server
    - Database backup server
  - All servers are in the same VCN (Virtual Cloud Network)
  - SSH access through Ubuntu user with sudo privileges

## Running Locally

### Prerequisites

- Node.js
- Docker & Docker Compose
- PostgreSQL
- Redis
- RabbitMQ

### Environment Variables (Required)

```
# Database
LSB_PG_URL=

# Server
PORT=
ENVIRONMENT=
JWT_SECRET=

# Redis — set REDIS_URL (redis:// or rediss://), which takes precedence,
# or the discrete fields below
REDIS_URL=
# REDIS_HOST=
# REDIS_PORT=
# REDIS_PASSWORD=
# REDIS_TLS=

# Email
SENDER_MAIL=
SENDER_PASSWORD=

# External Services
PHONEPE_BASE_URL=
PHONEPE_SALT_KEY=
PHONEPE_MERCHANT_ID=

# Observability
LOKI_USER_ID=
GRAFANA_API_TOKEN=
LOKI_HOST=

# API Keys
ADMIN_API_KEY=
FACTOR2_API_KEY=
IMGBB_API_KEY=

# Message Queue
RABBIT_MQ_URL=

# Optional Configurations
CAMPAIGN_REMINDER_DAYS=
OTP_TIME_OUT_MINUTES=
MINIMUM_CAMPAIGN_AMOUNT_IN_INR=
COMMA_SEPARATED_TESTING_PHONE_NUMBERS=
# Shopper OTP login is deprecated. Tenants authenticate their own shoppers and
# exchange that assertion for a customer session at POST /customer/session.
CUSTOMER_OTP_ENABLED=false
```

> **Connection pooling (Supabase):** the session pooler caps concurrent clients.
> The Prisma pool is capped automatically at `connection_limit=5` (see
> `PrismaService`) and pg-boss at `max: 3` (`JobSchedulerService`). Override the
> Prisma cap by adding `?connection_limit=<n>` to `LSB_PG_URL`.

### Running with Docker

1. Clone the repository
2. Create a .env file with the required environment variables
3. Run:
   ```bash
   docker-compose up -d
   ```

The application container runs `npx prisma migrate deploy` on startup (see the
`Dockerfile` `CMD`), so migrations are applied before the app boots.

### Running Locally Without Docker

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run Prisma migrations:
   ```bash
   npx prisma migrate deploy
   ```
4. Start the application:
   ```bash
   npm run start:dev
   ```

### Database Migrations

Migrations live in `prisma/migrations/`. The current history is a single
squashed baseline, `0_init_full`, that creates the entire public schema (every
model in `prisma/schema.prisma`). The previous incremental chain was incomplete
(it never created 20 of the tables), so it is archived under
`prisma/migrations_legacy/` for reference only - Prisma does not read it.

- **Fresh database** - nothing to do; the baseline is applied automatically:
  ```bash
  npx prisma migrate deploy   # applies 0_init_full
  ```
- **Database that already has this schema** (e.g. one previously synced with
  `prisma db push`) - baseline it once instead of running the baseline SQL:
  ```bash
  # clear history left behind by the old incremental migrations
  psql "$LSB_PG_URL" -c 'DELETE FROM _prisma_migrations;'
  npx prisma migrate resolve --applied 0_init_full
  npx prisma migrate status   # -> "Database schema is up to date"
  ```
- **Adding migrations** - always use `prisma migrate dev`, never `prisma db push`,
  so the history stays authoritative:
  ```bash
  npx prisma migrate dev --name <change>
  ```

Do not mix `prisma db push` and `prisma migrate deploy` against the same
environment - pick migrations (recommended) and stick to it.

Verify migrations still match the schema (useful in CI):
```bash
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" --exit-code
```

## Containerization Details

### Resource Allocation

- **Application Container**:
  - CPU: 2-4 cores (minimum 2, maximum 4)
  - Memory: 6-12GB (minimum 6GB, maximum 12GB)

### Container Services

1. **Main Application** (NestJS)

   - Port: 3003
   - Prometheus metrics enabled
   - Auto-restart unless stopped

2. **PostgreSQL**

   - Version: 16 Alpine
   - Custom configuration files mounted
   - Replication user configured for standby server
   - Health check: Every 5s

3. **RabbitMQ**

   - Version: 4.0.7 with management UI
   - Ports: 5672 (AMQP), 15672 (Management)
   - Health check: Every 10s

4. **Redis**

   - Latest version
   - Persistent volume
   - Health check: Every 5s

5. **Prometheus**
   - Latest version
   - Custom configuration mounted
   - Remote write receiver enabled
   - Health check: Every 5s

### Networking

- All services run on a dedicated bridge network 'lsbbe_net'
- Host machine accessible via host.docker.internal

### Persistent Volumes

- postgres_volume: PostgreSQL data
- redis_volume: Redis data
- prometheus_volume: Prometheus data

## Monitoring & Observability

- Prometheus metrics exposed at `/metrics`
- Node exporter for system metrics
- Grafana + Loki for log aggregation
- Metrics collected every 5 seconds

## CI/CD Pipeline

- GitHub Actions workflow
- Deployment process:
  1. SSH into target server
  2. Stop existing containers
  3. Pull latest code from appropriate branch
  4. Rebuild and start containers
- Branch-based deployments:
  - `main` -> production
  - `stage` -> staging
  - `dev` -> development

## Backup Strategy

- Database backups handled on separate backup servers
- Logical replication for PostgreSQL
- WAL (Write-Ahead Log) archiving
- Monitoring scripts for replication status
**. Never make a change silently — always link the fix/feature to a concept and give a resource.

## 🎓 Learning Requirement

When fixing, implementing, or changing anything, the AI assistant MUST include three sections:
1. **Concept** — the underlying idea/principle.
2. **Implementation Principle / Pattern applied** — name the SOLID principle, GoF design pattern, or architecture pattern used, and where in the code (file:line).
3. **Resource** — official docs/article for learning.

Every change is a learning opportunity; never change silently.

