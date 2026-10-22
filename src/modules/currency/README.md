# Currency Module

## Overview
The Currency Module manages custom loyalty currencies created by organizations. Organizations can define their own digital currencies (points, coins, rewards) with multi-currency support, exchange rates to physical currencies (INR), and currency bucket allocation tracking.

## Current State (Implemented Features)

### Currency Management
- **Create Currency**: Define new loyalty currency with name, code, symbol
- **Currency Association**: Link currency to organization
- **Currency Metadata**: Track symbol for UI representation
- **Currency Listing**: Retrieve all currencies for organization

### Exchange Rate Management
- **Record Exchange Rates**: Track conversion rate to physical currency (default: INR)
- **Historical Exchange Rates**: Maintain rate history for auditing
- **Rate Updates**: Change rates over time with timestamp tracking
- **Multi-Currency Support**: Different organizations can have different rates

### Currency Bucket System
- **Bucket Initialization**: Create currency bucket per organization-currency pair
- **Bucket Validation**: Prevent operations on non-existent buckets
- **Bucket Tracking**: Monitor available, distributed, and received amounts
  - `availableAmount`: Ready to distribute
  - `distributedAmount`: Already given to customers
  - `receivedAmount`: Earned back from customers

### Validations
- **Currency Existence Check**: Verify currency belongs to organization
- **Bucket Non-Empty Check**: Prevent deleting buckets with balance
- **Duplicate Currency Prevention**: One currency code per organization

## Database Models Used
- `Currency` - Currency definition with code, name, symbol
- `CurrencyBucket` - Allocation tracking per organization-currency
- `ExchangeRate` - Historical rates to physical currencies
- `Organization` - Owner of currency

## Dependencies
- `OrganizationService` - Organization validation
- `PrismaService` - Database operations
- `ConfigService` - Environment configuration
- `Logger` - Error logging

## Current Implementation Details

### Currency Structure
```typescript
{
  id: string,
  organizationId: string,
  code: string,              // e.g., 'PTS', 'COINS'
  name: string,              // e.g., 'Points', 'Loyalty Coins'
  symbol: string,            // e.g., 'Ⓟ', '◎'
  createdAt: Date,
  updatedAt: Date
}
```

### Currency Bucket Structure
```typescript
{
  id: string,
  organizationId: string,
  code: string,              // References Currency code
  availableAmount: Decimal,  // Ready to give out
  distributedAmount: Decimal,// Given to customers
  receivedAmount: Decimal,   // Earned back
}
```

### Exchange Rate Structure
```typescript
{
  id: string,
  currencyId: string,
  currencyCode: string,
  physicalCurrencyCode: string, // e.g., 'INR'
  rate: Decimal,             // Conversion rate
  createdAt: Date
}
```

## What They Want to Build (Future Goals)

### Phase 1: Real-Time Exchange Rates
- [ ] Implement dynamic exchange rate updates (TODO: noted in code)
- [ ] Integration with external rate APIs (Forex, OpenExchange)
- [ ] Scheduled rate refreshes (e.g., daily updates)
- [ ] Rate change history and analytics
- [ ] Alert when rates deviate beyond thresholds

### Phase 2: Multi-Currency Conversion
- [ ] Currency conversion utilities (A → B through INR)
- [ ] Currency pair conversion optimization
- [ ] Support cross-currency transactions
- [ ] Transaction logging for audit trail
- [ ] Real-time conversion rates for UI

### Phase 3: Currency Lifecycle
- [ ] Currency archival (mark as inactive)
- [ ] Currency deprecation with migration path
- [ ] Automatic conversion when currency deprecated
- [ ] Migration schedule for customers
- [ ] Backward compatibility during migration

### Phase 4: Bucket Management
- [ ] Bucket rebalancing algorithms
- [ ] Automatic bucket top-up when low
- [ ] Bucket reconciliation tools
- [ ] Manual bucket adjustments with audit trail
- [ ] Bucket forecasting and recommendations

### Phase 5: Currency Analytics
- [ ] Circulation metrics (available, distributed, received)
- [ ] Velocity analysis (how quickly currency circulates)
- [ ] Customer acquisition cost per currency
- [ ] Currency demand forecasting
- [ ] Inflation/deflation tracking

### Phase 6: Currency Rules Engine
- [ ] Expiry rules per currency (e.g., points expire after 12 months)
- [ ] Earning caps per currency
- [ ] Spending minimums
- [ ] Currency lockup periods
- [ ] Geographic currency restrictions

## API Endpoints
```
POST   /currencies                  - Create currency
GET    /currencies/:code           - Get currency details
GET    /currencies                 - List organization currencies
DELETE /currencies/:code           - Delete currency (if bucket empty)

POST   /currencies/:code/exchange-rates  - Record exchange rate
GET    /currencies/:code/exchange-rates  - Get exchange rate history
PUT    /currencies/:code/exchange-rates/:rateId  - Update exchange rate

POST   /currency-buckets/:code/initialize     - Initialize bucket
GET    /currency-buckets/:code               - Get bucket details
PUT    /currency-buckets/:code/adjust        - Adjust bucket amounts
```

## Error Handling
```
- InvalidCurrencyException (Currency doesn't exist)
- CurrencyBucketNotFoundException (Bucket not initialized)
- CurrencyBucketNotEmptyException (Cannot delete non-empty bucket)
- CurrencyAlreadyExistsException (Duplicate currency code)
- InvalidExchangeRateException (Invalid rate value)
```

## Database Constraints
- Unique constraint: (organizationId, code) for Currency
- Unique constraint: (organizationId, code) for CurrencyBucket
- Foreign key: Currency → Organization
- Foreign key: CurrencyBucket → Organization
- Index on: organizationId, code, exchangeRate.createdAt

## Notes
- Exchange rates stored as Decimal (Prisma type for precision)
- Default exchange rate target is INR
- Bucket amounts never negative (enforced at application level)
- Currency code typically 3-4 uppercase characters
- No duplicate currency codes per organization
- Exchange rate history immutable (insert-only)
- Consider caching frequently accessed exchange rates

## 🎓 Learning Requirement

When fixing, implementing, or changing anything, the AI assistant MUST include three sections:
1. **Concept** — the underlying idea/principle.
2. **Implementation Principle / Pattern applied** — name the SOLID principle, GoF design pattern, or architecture pattern used, and where in the code (file:line).
3. **Resource** — official docs/article for learning.

Every change is a learning opportunity; never change silently.

