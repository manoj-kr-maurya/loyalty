# Customer Module

## Overview
The Customer Module manages end-user profiles and registration in the loyalty ecosystem. Customers are individuals who participate in loyalty programs, earn rewards through campaigns, and manage their loyalty wallets across multiple organizations and currencies.

## Identity Model

A customer is a **shopper of a tenant**. The loyalty engine is a service
provider, not the shop: the tenant authenticates the shopper in its own
product and asserts that identity to this engine.

```
Shopper  → authenticates in the tenant's app (tenant's OTP, membership card, app login)
Tenant   → POST /customer/session   (x-api-key, tenant is bound to the API key)
            body: { externalId?, phoneNumber?, name? }
            → engine resolves or creates the TENANT SCOPED customer
            → returns a 15 minute, tenant scoped, audience bound token
Tenant app → GET /customer/me with Authorization: Bearer <token>
            → every query is scoped to the tenant the token was minted for
```

**This engine never sends an OTP to a shopper.** The public shopper OTP
endpoints (`POST /customer/otp/phone`, `POST /customer/otp/validate`) are
deprecated and answer `410 Gone` unless `CUSTOMER_OTP_ENABLED=true` is set.

### Tenant scoping rules
- `Customer.organizationId` is **required**. A shopper identity belongs to
  exactly one tenant.
- Uniqueness is per tenant: `@@unique([organizationId, phoneNumber])`. The same
  phone number at two tenants is two different customers.
- `externalId` is the identifier the tenant uses for the shopper:
  `@@unique([organizationId, externalId])`.
- A customer session token carries the tenant. Customer facing reads are
  scoped by it; the customer id is never taken from the URL or the body.

### Migrating from the global customer model
`prisma/migrations/20261026120000_customer_tenant_scoping` converts the
historical global `Customer` rows. A customer that was known to more than one
tenant is split into one row per tenant and every tenant scoped record
(wallets, orders, tiers, statements, ledger entries, rewards, redemptions) is
re-pointed at the copy of its own tenant. Customers that were never known to
any tenant — rows created through the public shopper OTP flow with no wallet,
order or reward — are removed, because they cannot exist in a tenant scoped
model.

## Current State (Implemented Features)

### Customer Session (delegated authentication)
- **Create Session**: `POST /customer/session` resolves or creates a tenant scoped customer and returns a short lived, tenant scoped token
- **Session Reads**: `GET /customer/me`, `/me/wallets`, `/me/orders`, `/me/statement` and the customer loyalty ledger and tier endpoints
- **Tenant Scoped Queries**: Every customer facing read is filtered by the tenant in the session token

### Customer Registration (deprecated)
- **Create Customer**: Register new customer with phone-based identity — requires `organizationId` and `CUSTOMER_OTP_ENABLED=true`
- **Customer Profile**: Store customer name, phone, country code
- **Verification Status**: Track customer verification state

### Customer Data Management
- **Fetch Customer Profile**: Retrieve customer details by ID
- **Update Customer Information**: Modify customer profile fields
- **Phone Verification**: Mark customer as verified after OTP validation
- **Tenant Search**: Find customers of a tenant by phone or external id

### Customer Metadata
- **Metadata Flags**: Store custom metadata (key-value pairs)
- **Preference Management**: Store customer preferences
- **Custom Attributes**: Flexible attribute storage per customer

### Customer Organization Relationships
- **Per-Tenant Identity**: A customer belongs to exactly one tenant; its wallets and orders are scoped to that tenant
- **Tenant Scoped Wallets**: `CustomerWallet` is unique per `(customerId, organizationId, currencyCode)`

## Database Models Used
- `Customer` - Core customer entity, scoped to one tenant
- `MetaFlagsForCustomer` - Flexible metadata storage
- `CustomerWallet` - Per-organization, per-currency wallets
- `CustomerOrganizationOrder` - Transaction history

## Dependencies
- `PrismaService` - Database operations
- `AuthService` - Authentication integration
- `CustomerWalletService` - Wallet initialization
- `MailAndSmsService` - Verification notifications
- `CommonUtilsService` - Utility functions

## Current Implementation Details

### Customer Structure
```typescript
{
  id: string,
  name: string,
  phoneNumber: string,
  countryCode: string,      // e.g., '+91'
  email?: string,
  isVerified: boolean,
  createdAt: Date,
  updatedAt: Date,
  metaFlags: MetaFlagsForCustomer[]
}
```

### Customer DTO Example
```typescript
{
  name: "John Doe",
  phoneNumber: "9876543210",
  countryCode: "+91",
  email?: "john@example.com"
}
```

## What They Want to Build (Future Goals)

### Phase 1: Enhanced Profile
- [ ] Customer profile picture/avatar support
- [ ] Address/Location storage
- [ ] Preferred language selection
- [ ] Customer tier/VIP status
- [ ] Account creation source tracking

### Phase 2: Customer Segmentation
- [ ] Automatic segment assignment (based on spending, engagement)
- [ ] Custom segment creation by organizations
- [ ] Segment-based campaign targeting
- [ ] Behavioral segment scoring
- [ ] Predictive churn detection

### Phase 3: Customer Lifecycle
- [ ] Customer lifecycle state management (active, inactive, churned)
- [ ] Engagement scoring system
- [ ] Reactivation campaigns for inactive customers
- [ ] Customer value metrics (LTV, frequency, recency)
- [ ] Win-back campaigns

### Phase 4: Preferences & Communication
- [ ] Notification preferences (SMS, email, push)
- [ ] Frequency capping (max notifications per period)
- [ ] Language preferences
- [ ] Marketing consent management (GDPR compliance)
- [ ] Email subscription management

### Phase 5: Advanced Features
- [ ] Referral tracking (referred by which customer)
- [ ] Social connections (linked accounts)
- [ ] Payment method storage
- [ ] Address book for multiple delivery locations
- [ ] Account recovery options

### Phase 6: Customer Analytics
- [ ] Customer activity timeline
- [ ] Interaction history
- [ ] Device tracking
- [ ] Behavior prediction
- [ ] Customer 360 view
- [ ] Export customer data

### Phase 7: Compliance & Security
- [ ] GDPR data export capability
- [ ] Right to deletion (data anonymization)
- [ ] Consent management
- [ ] Privacy settings
- [ ] Account security settings
- [ ] Two-factor authentication setup

## API Endpoints
```
POST   /customers                   - Register new customer
GET    /customers/:id              - Get customer profile
PUT    /customers/:id              - Update customer profile
DELETE /customers/:id              - Delete customer account

GET    /customers/:id/metadata     - Get customer metadata
PUT    /customers/:id/metadata     - Update metadata
POST   /customers/:id/verify       - Verify customer (OTP)

GET    /customers/:id/organizations - List organizations for customer
GET    /customers/:id/wallets      - List customer wallets
GET    /customers/:id/orders       - List customer orders

POST   /customers/:id/avatar       - Upload avatar/profile picture
```

## Validations
- Phone number format validation
- Country code validation
- Email format validation (if provided)
- Unique phone number per customer
- Metadata key-value type validation

## Error Handling
```
- CustomerNotFoundException (Customer doesn't exist)
- DuplicatePhoneNumberException (Phone already registered)
- InvalidPhoneFormatException (Invalid phone format)
- InvalidEmailFormatException (Invalid email format)
- CustomerNotVerifiedException (Required for some operations)
```

## Database Constraints
- Primary Key: id
- Unique Index: phoneNumber
- Foreign Keys: metaFlags.customerId, wallets.customerId, orders.customerId
- Check Constraint: countryCode matches pattern

## External Service Integration
- **Auth Service**: Customer login/token generation
- **Wallet Service**: Auto-initialize wallets on organization join
- **Notification Service**: Send verification OTP, welcome message

## Notes
- Customer phone number unique across platform
- Country code standardized to E.164 format (+CC)
- Verification status determines access to certain features
- Metadata allows extension without schema changes
- Customer can join multiple organizations independently
- Each organization-customer pair gets separate wallet set
- Customer data retention policy TBD

## 🎓 Learning Requirement

When fixing, implementing, or changing anything, the AI assistant MUST include three sections:
1. **Concept** — the underlying idea/principle.
2. **Implementation Principle / Pattern applied** — name the SOLID principle, GoF design pattern, or architecture pattern used, and where in the code (file:line).
3. **Resource** — official docs/article for learning.

Every change is a learning opportunity; never change silently.

