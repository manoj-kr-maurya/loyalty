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

# Redis
REDIS_PASSWORD=
REDIS_HOST=
REDIS_PORT=

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

### Running with Docker

1. Clone the repository
2. Create a .env file with the required environment variables
3. Run:
   ```bash
   docker-compose up -d
   ```

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

