# AGENTS.md - AI Agent Context & System Architecture

> **Last Updated**: January 2024  
> **Project**: JAS Loyalty Engine Microservice  
> **Version**: 1.0.0  
> **Framework**: NestJS + TypeScript + PostgreSQL + Redis

## 🎯 Project Overview

**JAS Loyalty Engine Microservice** is a comprehensive, enterprise-grade loyalty program management system built with NestJS. It enables retailers and brands (Organizations) to create custom loyalty programs, manage digital currency, run campaigns, and track customer rewards.

### Core Value Proposition
- **Organizations** (retailers/brands) create loyalty programs with custom currencies
- **Customers** earn loyalty points through campaigns and purchases
- **Wallets** track points with sophisticated state management (available, blocked, pending, used, expired)
- **Campaigns** define earning percentages with date-based execution
- **Orders** coordinate currency burning (spending) and earning (rewards)

---

## 🏗️ System Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | NestJS 9.0 | Backend framework |
| **Language** | TypeScript | Type-safe development |
| **Database** | PostgreSQL | Primary data store |
| **ORM** | Prisma 5.4 | Database abstraction |
| **Caching** | Redis | Session, cache management |
| **Job Queue** | pg-boss on PostgreSQL | Async job scheduling |
| **Message Queue** | RabbitMQ | Event-driven architecture |
| **Auth** | JWT + OTP | Authentication |
| **Email** | Nodemailer | Email delivery |
| **SMS** | Factor2 | SMS delivery |
| **Monitoring** | Prometheus + Grafana + Loki | Observability |
| **Deployment** | Docker | Containerization |
| **CI/CD** | GitHub Actions | Pipeline automation |

### Infrastructure

```
┌─────────────────────────────────────────────────────┐
│                   Load Balancer                     │
└───────────────┬─────────────────────────────────────┘
                │
        ┌───────┴───────┐
        │               │
    ┌───▼────┐     ┌───▼────┐
    │Instance │     │Instance │  (NestJS App Cluster)
    │   1     │     │   2     │
    └───┬────┘     └───┬────┘
        │               │
        └───────┬───────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼───┐  ┌───▼───┐
│Postgres│  │ Redis │
│Primary │  │Cache  │
└────────┘  └───────┘
    │
┌───▼────────────────┐
│ Backup / Standby   │ (HA Setup)
└────────────────────┘
```

### Cloud Deployment (Oracle Cloud)

- **3 Environments**: Stage, Prod, Dev
- **2 Servers per Environment**: Primary (App), Secondary (DB Backup)
- **Networking**: VCN (Virtual Cloud Network) for all servers
- **Access**: SSH via Ubuntu user with sudo privileges
- **Database**: PostgreSQL with replication from primary

---

## 📦 Domain Modules (src/modules/domain/)

### 1. **Admin Module** (`admin/`)
**Purpose**: System administration dashboard for managing all organizations and customers

**Key Features**:
- List organizations with search/pagination
- List customers with search/pagination
- View organization campaigns, currencies, orders
- View customer wallets with transaction history
- Admin invitations

**Database Models**: Organization, Customer, Currency, Campaign, Wallet, Order

**Future Goals**:
- Organization analytics (revenue, KPIs)
- Bulk operations
- Audit logging
- Feature flags

---

### 2. **Auth Module** (`auth/`)
**Purpose**: Authentication and authorization for Organizations and Customers

**Key Features**:
- JWT token generation (14-day expiry)
- Redis-backed session management
- Single-device login enforcement
- OTP verification via email/SMS
- Stateful authentication model

**Security**:
- Session ID validation
- JWT signature verification
- Rate limiting on OTP attempts (TODO: production enablement)
- User type validation (TODO: implementation)

**Future Goals**:
- Refresh tokens
- Multi-device sessions
- Firebase/OAuth integration
- 2FA/MFA support
- Asymmetric JWT (RS256)

---

### 3. **Campaign Module** (`campaign/`)
**Purpose**: Define and manage loyalty earning campaigns

**Key Features**:
- Create/edit campaigns with date ranges
- Campaign overlap validation (prevents duplicate earning)
- Earning percentage configuration
- Currency allocation tracking
- Potential earnings calculation
- Automatic job scheduling for expiry

**Business Logic**:
```
Campaign:
  - organizationId: Which retailer
  - startDate, endDate: Earning window
  - earningPercentage: e.g., 5% of purchase = points earned
  - currencyCode: Which loyalty currency
  - status: ACTIVE, EXPIRED, INACTIVE
```

**Future Goals**:
- Tiered earning percentages
- Category-based campaigns
- Customer segment targeting
- Campaign A/B testing
- Performance analytics

---

### 4. **Currency Module** (`currency/`)
**Purpose**: Manage organization-specific loyalty currencies

**Key Features**:
- Create custom currencies (e.g., POINTS, COINS)
- Exchange rate tracking to INR
- Currency bucket for allocation tracking
  - `availableAmount`: Ready to distribute
  - `distributedAmount`: Given to customers
  - `receivedAmount`: Earned back
- Prevent empty bucket deletion

**Data Model**:
```
Currency:
  code: "PTS"
  name: "Points"
  symbol: "Ⓟ"
  exchangeRate: 0.10 (₹ per point)
```

**Future Goals**:
- Dynamic exchange rate updates (TODO: noted in code)
- Multi-currency conversion
- Currency expiry rules
- Auto-replenishment
- Circulation analytics

---

### 5. **Customer Module** (`customer/`)
**Purpose**: Manage customer profiles and lifecycle

**Key Features**:
- Create/update customer profiles
- Phone-based identity
- Email optional
- Verification tracking
- Metadata/custom attributes
- Multi-organization participation

**Data Model**:
```
Customer:
  phoneNumber: "9876543210"
  countryCode: "+91"
  name: "John Doe"
  isVerified: boolean
  metaFlags: CustomAttributes
```

**Future Goals**:
- Customer segmentation (VIP, active, inactive)
- Lifecycle management
- Churn prediction
- Behavioral scoring
- GDPR compliance (data export, deletion)

---

### 6. **Customer-Organization-Order Module** (`customer-organization-order/`)
**Purpose**: Core transaction flow - burning cash to earn loyalty points

**Key Features**:
- Order creation with amount
- Burning details: Cash spent (INR)
- Earning details: Points earned (auto-calculated)
- Status tracking (PENDING → PROCESSING → COMPLETED)
- Nested transaction history

**Business Flow**:
```
Customer makes purchase:
  → Order created with burn amount (e.g., ₹5,000)
  → Campaign matching calculates earn (e.g., 500 points @ 5%)
  → Wallet credits points
  → Order marked COMPLETED
  → Receipt with points earned
```

**Data Model**:
```
CustomerOrganizationOrder:
  customerId
  organizationId
  status: PENDING | PROCESSING | COMPLETED
  burnAmount: Decimal (cash)
  earnAmount: Decimal (points) - auto-calculated
  customerBurningAmountDetail:
    amount: 5000
    cash: { code: "INR", name: "Indian Rupee" }
    coin: { code: "PTS", name: "Points" }
  customerEarningAmountDetail:
    amount: 500
    coin: { code: "PTS" }
```

**Future Goals**:
- Refund processing
- Order cancellation workflow
- Payment gateway integration (PhonePe)
- Multi-order reconciliation
- Dispute resolution

---

### 7. **Customer-Wallets Module** (`customer-wallets/`)
**Purpose**: Manage customer loyalty point balances with sophisticated state tracking

**Key Features**:
- Wallet per (customer, currency) combination
- Multi-state balance tracking:
  - `availableBalance`: Ready to spend
  - `blockedBalance`: Reserved/locked
  - `pendingBalance`: In processing
  - `usedBalance`: Already spent
  - `expiredBalance`: Past expiry
- Pocket-based transaction grouping
- Queue-based async operations
- FIFO point consumption (oldest first)

**Operations**:
- Add pending points (queue for processing)
- Block points (reserve from available)
- Credit pending (move pending → available)
- Unblock (return blocked → available)
- Debit blocked (consume points)

**Data Model**:
```
CustomerWallet:
  customerId
  currencyCode
  availableBalance: 2500
  blockedBalance: 100
  pendingBalance: 50
  usedBalance: 5000
  expiredBalance: 1000
  pockets: [
    {
      id, status, expiryDate,
      transactions: [
        { type: CREDIT/DEBIT, amount, status }
      ]
    }
  ]
```

**Future Goals**:
- Wallet rebalancing
- Auto top-up on low balance
- Transaction rollback
- Cross-wallet transfers
- Expiry management
- Dispute resolution

---

### 8. **Mail-and-SMS Module** (`mail-and-sms/`)
**Purpose**: Multi-channel notification delivery

**Providers**:
- **Email**: Nodemailer (SMTP)
- **SMS**: Factor2 API

**Current Features**:
- OTP delivery via email/SMS
- Template-based messaging
- Organization OTP (hardcoded template - TODO)
- Sender 'LSBONE' (hardcoded - TODO: fetch from DB)

**Data Model**:
```
Notification:
  type: OTP | ORDER_CONFIRMATION | CAMPAIGN_ALERT
  recipient: phone or email
  message: template-rendered
  deliveryMethod: EMAIL | SMS
  status: SENT | DELIVERED | FAILED
```

**Future Goals**:
- Database template management (TODO noted in code)
- Database sender configuration (TODO noted in code)
- HTML email templates
- Delivery tracking
- Notification preferences (opt-in/out)
- Multi-language support
- Email personalization

---

### 9. **Organization Module** (`organization/`)
**Purpose**: Core business entity - retailers/brands creating loyalty programs

**Key Features**:
- Organization registration with phone verification
- OTP-based authentication
- Role-based access (ADMIN, SHOP)
- Team member invitations
- Currency and campaign setup
- Organization profile management
- Logo upload via ImgBB

**Workflows**:
1. **Registration**: Phone → OTP verification → Account created
2. **Onboarding**: Create currency → Setup campaigns → Invite team → Go live
3. **Team**: Invite shop managers → Accept invite → Role assignment

**Data Model**:
```
Organization:
  phoneNumber: unique
  name, address, logo
  isVerified: boolean
  currencies: Currency[]
  campaigns: Campaign[]
  customers: Customer[]
  metaFlags: CustomAttributes
```

**Future Goals**:
- Sub-organizations (branches)
- KYC verification workflow
- Subscription tiers with feature limits
- API key generation
- Webhook support
- GDPR compliance

---

### 10. **Organization-Order Module** (`organization-order/`)
**Purpose**: Track organization currency purchases from platform

**Key Features**:
- Currency purchase orders
- Payment processing
- Order history with filtering
- Amount tracking (quantity × rate)

**Workflow**:
```
Organization wants loyalty currency:
  → Request purchase order
  → Specify amount and currency
  → Calculate cost (amount × exchange rate)
  → Process payment (PhonePe, etc.)
  → Top-up currency bucket
  → Complete order
```

**Future Goals**:
- PhonePe payment integration
- Multiple payment methods
- Bulk order creation
- Volume-based pricing
- Recurring billing
- Reconciliation tools
- Invoice generation

---

### 11. **Shop Module** (`shop/`)
**Purpose**: Point-of-sale retail locations under organizations

**Key Features**:
- Shop registration under organization
- Shop profile with location details
- POS terminal management
- Transaction processing at store level
- Staff assignment

**Data Model**:
```
Shop:
  organizationId
  shopCode: unique for POS
  name, address, city, pinCode
  managerId
  operatingHours: start, end
  isActive: boolean
```

**Future Goals**:
- POS API integration
- Real-time balance check at checkout
- Receipt integration
- Transaction sync
- Shop analytics
- Staff management
- Shift tracking

---

## 🔌 Core Modules (src/modules/core/)

### **JobScheduler** (`modules/jobs/`)
**Purpose**: Async job scheduling and processing via pg-boss (PostgreSQL-backed)

- **Technology**: pg-boss on PostgreSQL (`pgboss` schema in the primary DB)
- **Use Cases**:
  - Campaign expiry reminders
  - Wallet point auto-expiry
  - Pending order processing
  - Notification reminders
  - Report generation
- **Features**: Job persistence, retry logic, recurring schedules
- **Future**: Cron scheduling, monitoring dashboard, dead letter queue

---

### **Health** (`core/health/`)
**Purpose**: Application health checks and monitoring

- **Checks**:
  - PostgreSQL connectivity
  - Redis connectivity
  - Memory usage
  - Disk space
- **Endpoints**:
  - `GET /health` - Full report
  - `GET /health/live` - Liveness probe (K8s)
  - `GET /health/ready` - Readiness probe (K8s)
- **Future**: Prometheus metrics, Grafana dashboards, alerting

---

### **HTTP** (`core/http/`)
**Purpose**: HTTP client for external API integration

- **Providers**: PhonePe, ImgBB, Email/SMS APIs
- **Features**: Error handling, retry logic, logging
- **Future**: Circuit breaker, rate limiting, caching, distributed tracing

---

### **Listener** (`core/listener/`)
**Purpose**: Event-driven architecture with webhooks

- **Events**:
  - customer.created, customer.verified
  - campaign.started, campaign.ended
  - order.created, order.completed
  - wallet.credited, wallet.debited
  - organization.created, organization.verified
- **Implementation**: PostgreSQL LISTEN/NOTIFY, webhook delivery
- **Future**: Event sourcing, message queue integration, saga pattern

---

## 🗄️ Database Schema (Key Entities)

### Core Entities
```
Organization
  ├─ Currency (custom loyalty currencies)
  ├─ OrganizationCampaign (earning campaigns)
  ├─ CurrencyBucket (currency allocation)
  └─ MetaFlagsForOrganization (custom attributes)

Customer
  ├─ CustomerWallet (one per currency)
  │  ├─ CustomerWalletPocket (transaction grouping)
  │  │  └─ CustomerWalletPocketTransaction (individual txn)
  ├─ CustomerOrganizationOrder (purchase orders)
  │  ├─ CustomerEarningAmountDetail (points earned)
  │  └─ CustomerBurningAmountDetail (cash spent)
  └─ MetaFlagsForCustomer (custom attributes)

Shop (POS locations)
  └─ POSTerminal (payment terminals)

Invite (team invitations)
```

### Key Relationships
- **Organization** → Organization (self-join for hierarchy)
- **Currency** ← Organization (many-to-one)
- **Customer** ← Organization (many-to-many via wallet)
- **Campaign** ← Organization (many-to-one)
- **Order** ← Customer + Organization (many-to-one each)
- **Wallet** ← Customer + Currency (unique per pair)

---

## 🔄 Key Workflows

### Workflow 1: Organization Onboarding
```
1. Phone Entry
   ├─ Verify organization doesn't exist
   └─ Create organization with PENDING status

2. OTP Verification
   ├─ Generate and send OTP
   ├─ Validate OTP entry
   └─ Mark organization VERIFIED

3. JWT Generation
   ├─ Create session ID
   ├─ Generate JWT (14-day expiry)
   ├─ Store session in Redis
   └─ Return token

4. Initial Setup (POST-LOGIN)
   ├─ Create loyalty currency
   ├─ Initialize currency bucket
   ├─ Define first campaign
   └─ Invite team members
```

### Workflow 2: Customer Loyalty Flow
```
1. Customer Registration
   ├─ Phone-based registration
   ├─ OTP verification
   ├─ Account created with UNVERIFIED status
   └─ JWT token issued

2. Customer Joins Organization
   ├─ Find/scan organization code at shop
   ├─ Auto-create wallet for each org currency
   ├─ Link customer to organization
   └─ Welcome notification sent

3. Purchase Transaction
   ├─ Cashier scans customer phone
   ├─ Retrieve active campaigns
   ├─ Calculate points to earn (amount × earning %)
   ├─ Process payment
   ├─ Debit cash from wallet (burn)
   ├─ Credit points to wallet (earn)
   ├─ Order marked COMPLETED
   └─ Receipt printed with points earned

4. Point Redemption (Future)
   ├─ Customer requests points
   ├─ Block points from available
   ├─ Process redemption
   ├─ Debit points (used balance)
   └─ Apply discount to transaction
```

### Workflow 3: Campaign Execution
```
1. Campaign Creation
   ├─ Validate dates don't overlap
   ├─ Check currency exists for org
   ├─ Create campaign record
   ├─ Allocate currency from bucket
   └─ Schedule expiry reminder job

2. Campaign Active (Date Range)
   ├─ All matching orders calculate earn
   ├─ Earning % applied to order amount
   ├─ Campaigns are ACTIVE

3. Campaign Expiry
   ├─ Scheduled job triggers before end date
   ├─ Send expiry reminder to organization
   ├─ Auto-disable campaign
   └─ Remaining currency returned to bucket

4. Post-Campaign Analysis
   ├─ Calculate total earnings generated
   ├─ Track customers reached
   ├─ Compute ROI
   └─ Store for reporting
```

---

## 🔐 Security & Authentication

### JWT Structure
```
Header:
  alg: "HS256"
  typ: "JWT"

Payload:
  sub: "USER_ID"
  sessionId: "SESSION_ID"
  userType: "Organization" | "Customer"
  iat: 1234567890
  exp: 1234567890 + 14 days

Signature: HMAC-SHA256(header + payload, JWT_SECRET)
```

### Session Management
```
Redis Key: "{userId}-session"
Value: sessionId
TTL: 14 days

On Each Request:
  1. Verify JWT signature
  2. Check sessionId matches Redis value
  3. Allow request or reject (401)
```

### TODO Security Items
- Production OTP verification enablement
- User type validation implementation
- Additional rate limiting
- Token rotation strategy

---

## 🚀 Deployment & Infrastructure

### Environment Setup
```
Stage Environment:
  ├─ Instance 1: Primary app + database
  └─ Instance 2: Backup/replication

Prod Environment:
  ├─ Instance 1: Primary app + database
  └─ Instance 2: Backup/replication

Dev Environment:
  └─ Single instance for testing
```

### Database Configuration
```
PostgreSQL:
  ├─ Primary: Handles all reads/writes
  ├─ Standby: Replication for HA
  ├─ Backup: Periodic WAL archiving
  └─ Monitoring: PostgreSQL exporter

Connection Pooling:
  Max Connections: 100
  Min Idle: 10
```

### Cache Strategy
```
Redis:
  ├─ Sessions: sessionId → validation
  ├─ Cache: Organization metadata, currencies
  ├─ Rate Limiting: OTP attempts per phone
  └─ Temporary: OTP codes with 10-min TTL
```

### Job Queue (PostgreSQL / pg-boss)
```
pgboss.job (partitioned by queue name):
  ├─ Job persistence
  ├─ Retry tracking (retry_limit/retry_count/retry_backoff)
  ├─ Status history (state + created/started/completed timestamps)
  └─ Lock / heartbeat mechanism (expire_seconds, heartbeat_seconds)
```

---

## 📊 API Organization

### Admin Routes (`/admin/*`)
```
GET    /admin/organizations              - List with pagination
GET    /admin/organizations/:id          - Get details
GET    /admin/customers                  - List with pagination
GET    /admin/customers/:id              - Get details
POST   /admin/invites                    - Send invite
```

### Organization Routes (`/organizations/*`)
```
POST   /organizations/register           - Register
POST   /organizations/login              - Request OTP
POST   /organizations/verify-otp         - Verify & login
GET    /organizations/:id                - Profile
PUT    /organizations/:id                - Update
GET    /organizations/:id/campaigns      - Campaigns
GET    /organizations/:id/currencies     - Currencies
POST   /organizations/:id/invite         - Invite member
```

### Customer Routes (`/customers/*`)
```
POST   /customers                        - Register
GET    /customers/:id                    - Profile
PUT    /customers/:id                    - Update
GET    /customers/:id/wallets            - Wallets
GET    /customers/:id/orders             - Orders
POST   /customers/:id/verify-otp         - Verify
```

### Campaign Routes (`/campaigns/*`)
```
POST   /campaigns                        - Create
PUT    /campaigns/:id                    - Edit
GET    /campaigns/:id                    - Details
GET    /campaigns/:id/potential-earnings - Calculate
```

### Wallet Routes (`/wallets/*`)
```
POST   /wallets/:customerId/:currency/initialize      - Init
GET    /wallets/:customerId/:currency                 - Details
POST   /wallets/:customerId/:currency/add-pending     - Add points
POST   /wallets/:customerId/:currency/block           - Block
POST   /wallets/:customerId/:currency/debit           - Spend
```

---

## 🎯 AI Agent Instructions

### How to Investigate

1. **Module Analysis**:
   - Read the corresponding README.md in each module directory
   - Check service.ts for business logic
   - Review DTO files for data structures
   - Check exceptions for error handling

2. **Finding Code**:
   - Use `grep_search` for specific patterns
   - Use `semantic_search` for concept understanding
   - Check `src/modules/domain/{module}/` for implementations

3. **Understanding Flows**:
   - Review service methods in order
   - Check dependencies between services
   - Look for Prisma queries to understand data flow
   - Trace job queue usage (JobScheduler/pg-boss)

4. **Database Understanding**:
   - Check `prisma/schema.prisma` for models
   - Review relationships and constraints
   - Look at migration files for evolution

### Common Tasks

#### Add New Feature to Module
1. Review module README.md for existing state
2. Check service.ts for similar patterns
3. Add DTO if needed
4. Implement service method
5. Add controller endpoint
6. Update tests
7. Document in README.md

#### Troubleshoot Issues
1. Check error messages in exceptions/
2. Review service logic for business logic
3. Check database queries in Prisma helpers
4. Review middleware and interceptors
5. Check job queue for async failures
6. Review logs for stack traces

#### Understand Data Flow
1. Start with API endpoint in controller
2. Trace through service methods
3. Follow Prisma queries
4. Check cache invalidation
5. Review job queue triggers
6. Check event emissions

#### Performance Optimization
1. Review database queries (N+1 problems)
2. Check cache usage (hit rate)
3. Review job queue (queue depth)
4. Check API response times
5. Profile memory usage
6. Review connection pooling

### Code Patterns

#### Service Pattern
```typescript
@Injectable()
export class XyzService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private logger: Logger
  ) {}

  async doSomething(input: Input): Promise<Output> {
    try {
      // Validation
      // Business logic
      // Database operations
      // Logging
      return result;
    } catch (error) {
      this.logger.error('Error in doSomething', error);
      throw new CustomException(error.message);
    }
  }
}
```

#### Error Handling Pattern
```typescript
export class CustomException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.CONFLICT);
  }
}

// Usage
if (!found) {
  throw new CustomException('Entity not found');
}
```

#### Database Query Pattern
```typescript
const result = await this.prisma.entity.findMany({
  where: { condition },
  include: { relations: true },
  skip: pagination.skip,
  take: pagination.take,
  orderBy: { field: 'desc' }
});
```

---

## 📋 TODO Items in Codebase

### High Priority
- [ ] OTP verification production enablement (Auth module)
- [ ] User type validation (Auth module)
- [ ] Template management database integration (Mail-SMS module)
- [ ] Exchange rate dynamic updates (Currency module)
- [ ] Campaign logic completion (Campaign module)

### Medium Priority
- [ ] PhonePe payment integration
- [ ] Organization analytics dashboard
- [ ] Webhook management system
- [ ] Event sourcing implementation

### Nice-to-Have
- [ ] Advanced reporting
- [ ] Predictive analytics
- [ ] Machine learning integrations
- [ ] Mobile app support

---

## 🔗 Important Files

### Configuration
- `.env` - Environment variables
- `nest-cli.json` - NestJS CLI config
- `tsconfig.json` - TypeScript config
- `docker-compose.yaml` - Container setup
- `ecosystem.config.js` - PM2 configuration

### Database
- `prisma/schema.prisma` - Data models
- `prisma/migrations/` - Migration history
- `scripts/postgres/` - DB setup scripts

### Monitoring
- `non-service-conf-files/prometheus.yml` - Prometheus config
- `non-service-conf-files/nginx.conf` - Nginx config
- `scripts/prometheus/` - Prometheus setup

### Source Code Structure
```
src/
  ├─ main.ts                     # App entry point
  ├─ app.module.ts               # Root module
  ├─ common/                     # Shared utilities
  │  ├─ decorators/             # Custom decorators
  │  ├─ exceptions/             # Custom exceptions
  │  ├─ services/               # Shared services (cache, DB)
  │  ├─ utils/                  # Utilities
  │  └─ enums/                  # Constants
  ├─ config/                     # Configuration
  │  ├─ env-schema.ts           # Env validation
  │  ├─ enums.ts                # Config enums
  │  └─ types.ts                # Config types
  ├─ interceptors/              # Request/response
  │  ├─ auth/                   # Auth logic
  │  ├─ cache/                  # Caching logic
  │  └─ log/                    # Logging
  ├─ middlewares/               # Request middlewares
  ├─ modules/
  │  ├─ domain/                 # Business domain
  │  │  ├─ admin/
  │  │  ├─ auth/
  │  │  ├─ campaign/
  │  │  ├─ currency/
  │  │  ├─ customer/
  │  │  ├─ customer-organization-order/
  │  │  ├─ customer-wallets/
  │  │  ├─ mail-and-sms/
  │  │  ├─ organization/
  │  │  ├─ organization-order/
  │  │  └─ shop/
  │  ├─ core/                   # Infrastructure
  │  │  ├─ jobs/                # Job scheduling (pg-boss)
  │  │  ├─ http/                # HTTP client
  │  │  ├─ listener/            # Events/webhooks
  │  │  └─ (more services)
  │  └─ health/                 # Health checks
```

---

## 🎓 Learning Resources for Agents

### Understanding the Business
1. **Loyalty Programs**: Revenue model, customer retention, point economics
2. **Multi-Currency Systems**: Exchange rates, bucket management
3. **Wallet Systems**: State machines, transaction atomicity
4. **Campaign Management**: Time-based constraints, earning calculations

### Understanding the Code
1. **NestJS Patterns**: Modules, services, controllers, dependency injection
2. **Prisma Usage**: Schema, queries, migrations, relations
3. **Async Operations**: Job queues, event listeners, promises
4. **Error Handling**: Custom exceptions, HTTP status codes

### Common Implementation Patterns
1. **Service methods**: Validation → Business logic → DB ops → Response
2. **Error handling**: Try-catch → Custom exception → Log
3. **Database**: Prisma client → Where clauses → Include relations
4. **Caching**: Store → Retrieve → Invalidate on changes

---

## 📞 Support & Escalation

### For Architecture Questions
- Review AGENTS.md (this file)
- Check module README.md files
- Review service.ts implementations

### For Bug Investigation
- Check error logs in /debug-logs/
- Review recent commits
- Check database migrations
- Review health checks

### For Performance Issues
- Review Prometheus metrics
- Check database query times
- Monitor job queue depth
- Check cache hit rates
- Review API response times

---

**Version**: 1.0.0  
**Last Updated**: January 2024  
**Maintained by**: Development Team  
**Next Review**: Q2 2024

## 🎓 Learning Requirement for AI Assistants

When you (the AI assistant) are **fixing, implementing, or changing anything** in this project, you **MUST** include the following sections in your explanation:

1. **Concept** — the underlying programming/architecture idea behind the change (e.g. dependency injection, pipe scope, request lifecycle, Joi validation, route matching, DB transactions, etc.).

2. **Implementation Principle / Pattern applied** — the concrete design principle or GoF/architecture pattern that the code follows. Examples:
   - **SOLID**: Single Responsibility, Open/Closed, Dependency Inversion, etc.
   - **Creational**: Factory, Builder, Singleton
   - **Structural**: Adapter, Facade, Decorator, Proxy
   - **Behavioral**: Strategy, Template Method, Chain of Responsibility, Observer
   - **Architectural**: Layered architecture, Dependency Injection, BFF, Repository, Service Layer, DTO, Pipe/Interceptor pattern (NestJS-specific)
   
   Name the principle/pattern explicitly and point to where in the code it is applied (file:line).

3. **Resource(s)** — official docs, articles, or references so the team can learn more.

The purpose is that **every change is a learning opportunity**. Never make a change silently. Always link the fix/feature to a concept, an applied implementation principle/pattern, and a resource.

### ✅ Example of a good explanation

```
## Concept
Dependency Injection (DI): passing dependencies via constructor instead of hardcoding them
makes the service testable and decoupled.

## Implementation Principle applied
Dependency Inversion Principle (SOLID D) + NestJS DI container.
- PromoService declares CouponValidatorService in its constructor (promo.service.ts:61)
  instead of instantiating it, so the validator can be swapped/mocked.
- Strategy Pattern: CouponValidatorService stores a list of ValidationRule objects
  and iterates them, letting each rule (status, expiry, cart limit) be added/removed
  independently without changing the core loop (coupon-validator.service.ts:124).

## Resources
- https://docs.nestjs.com/providers  (NestJS DI)
- https://refactoring.guru/design-patterns/strategy  (Strategy pattern)
```

