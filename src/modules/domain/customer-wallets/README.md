# Customer-Wallets Module

## Overview
The Customer-Wallets Module manages customer loyalty point balances and transactional states. It implements a sophisticated pocket-based system for tracking different point states (available, blocked, pending, used, expired) with transaction history and supports queue-based async operations for wallet updates.

## Current State (Implemented Features)

### Wallet Management
- **Initialize Wallet**: Create new wallet per customer-currency combination
- **Upsert Wallet**: Create if not exists, return existing if exists
- **Wallet Persistence**: Unique constraint on (customerId, currencyCode)
- **Wallet Access**: Retrieve wallets with full transaction history

### Balance Tracking (Multi-State)
- **Available Balance**: Ready-to-use points
- **Blocked Balance**: Points reserved/locked (during transaction)
- **Pending Balance**: Points in processing state
- **Used Balance**: Points already spent
- **Expired Balance**: Points past expiry date

### Transaction States & Operations
- **Add Pending Points**: Queue points for processing
- **Block Points**: Lock points from available balance
- **Credit Pending Points**: Move pending to available
- **Unblock Points**: Release blocked points back to available
- **Debit Blocked Points**: Reduce blocked balance (consume points)

### Pocket System
- **Pocket Creation**: Create pockets for transaction grouping
- **Pocket Transactions**: Track individual transactions per pocket
- **Transaction Status**: Track transaction state (pending, completed, failed)
- **Expiry Tracking**: Pocket-level expiry rules
- **FIFO Processing**: First-in-first-out pocket consumption

### Async Job Processing
- **Job Queue Integration**: Queue-based wallet operations
- **Producer Pattern**: CustomerWalletJobProducer for job creation
- **Scalable Processing**: Non-blocking wallet updates
- **Retry Logic**: Job retry on failure

## Database Models Used
- `CustomerWallet` - Wallet entity with balance tracking
- `CustomerWalletPocket` - Transaction grouping
- `CustomerWalletPocketTransaction` - Individual transactions
- `Customer` - Wallet owner
- `Currency` - Currency type

## Dependencies
- `CustomerWalletJobProducer` - Queue job creation
- `PrismaService` - Database operations
- `Agenda` - Job scheduling
- `Logger` - Error logging

## Current Implementation Details

### Wallet Structure
```typescript
{
  id: string,
  customerId: string,
  currencyCode: string,
  
  // Balance breakdown
  availableBalance: Decimal,
  blockedBalance: Decimal,
  pendingBalance: Decimal,
  usedBalance: Decimal,
  expiredBalance: Decimal,
  
  createdAt: Date,
  updatedAt: Date,
  
  // Nested relations
  pockets: [{
    id: string,
    status: "ACTIVE" | "EXPIRED" | "EXHAUSTED",
    expiryDate: Date,
    transactions: [{
      id: string,
      type: "CREDIT" | "DEBIT",
      amount: Decimal,
      status: "PENDING" | "COMPLETED" | "FAILED",
      createdAt: Date
    }]
  }]
}
```

### Wallet Balance Constraints
```
Total = availableBalance + blockedBalance + pendingBalance + usedBalance + expiredBalance
```

### Operation Effects

| Operation | Available | Blocked | Pending | Used | Expired |
|-----------|-----------|---------|---------|------|---------|
| Add Pending | - | - | +X | - | - |
| Block Points | -X | +X | - | - | - |
| Credit Pending | +X | - | -X | - | - |
| Unblock Points | +X | -X | - | - | - |
| Debit Blocked | - | -X | - | +X | - |

## What They Want to Build (Future Goals)

### Phase 1: Wallet Rebalancing
- [ ] Automatic rebalancing algorithm
- [ ] Manual rebalance with audit trail
- [ ] Balance reconciliation tools
- [ ] Integrity checks and fixing
- [ ] Discrepancy reporting

### Phase 2: Auto Top-Up Feature
- [ ] Automatic wallet top-up when balance low
- [ ] Configurable top-up thresholds
- [ ] Top-up event logging
- [ ] Bulk top-up operations
- [ ] Top-up history and audit

### Phase 3: Transaction Management
- [ ] Transaction rollback capability
- [ ] Transaction reversal workflow
- [ ] Chargeback handling
- [ ] Dispute resolution
- [ ] Transaction export/reporting

### Phase 4: Expiry Management
- [ ] Point expiry rules per currency
- [ ] Expiry reminder notifications
- [ ] Automatic expiry processing
- [ ] Expiry waiver/extension requests
- [ ] Expiry analytics

### Phase 5: Cross-Wallet Operations
- [ ] Transfer points between wallets (same customer)
- [ ] Exchange between currencies
- [ ] Currency conversion with rates
- [ ] Transfer audit trail
- [ ] Transfer reversals

### Phase 6: Wallet Analytics
- [ ] Wallet velocity (points earned/spent rate)
- [ ] Churn prediction (dormant wallets)
- [ ] Point redemption patterns
- [ ] Wallet lifetime value
- [ ] Forecasting wallet growth

### Phase 7: Advanced Features
- [ ] Wallet sharing/gifting
- [ ] Wallet recovery options
- [ ] Dispute resolution UI
- [ ] Point borrowing with repayment
- [ ] Wallet backup/recovery

## API Endpoints
```
POST   /wallets/:customerId/:currencyCode/initialize  - Initialize wallet
GET    /wallets/:customerId/:currencyCode            - Get wallet details
GET    /customers/:customerId/wallets               - List all wallets

POST   /wallets/:customerId/:currencyCode/add-pending    - Add pending points
POST   /wallets/:customerId/:currencyCode/block          - Block points
POST   /wallets/:customerId/:currencyCode/credit-pending - Credit pending
POST   /wallets/:customerId/:currencyCode/unblock        - Unblock points
POST   /wallets/:customerId/:currencyCode/debit          - Debit blocked points

GET    /wallets/:customerId/:currencyCode/transactions   - Transaction history
GET    /wallets/:customerId/:currencyCode/pockets        - List pockets
POST   /wallets/:customerId/:currencyCode/reconcile      - Reconcile balance
```

## Error Handling
```
- InsufficientCurrencyBalanceException (Not enough available points)
- TransactionNotFoundException (Transaction doesn't exist)
- InvalidTransactionStateException (Invalid operation for state)
- WalletNotFoundException (Wallet not initialized)
- InvalidAmountException (Negative or invalid amount)
- ExceededMaxTransactionLimitException
```

## Database Indexes
- Unique Index: (customerId, currencyCode) on CustomerWallet
- Index: customerId on CustomerWallet (for listing)
- Index: (walletId, status) on CustomerWalletPocket
- Index: (pocketId, status) on Transaction
- Index: (customerId, createdAt) for transaction history

## Balance Calculation
```
Total Available = sum of all available pockets (ACTIVE, non-expired)
Total Pending = points queued for processing
Total Blocked = points in transaction
Total Used = successfully consumed points
Total Expired = points past expiry

Grand Total = Available + Blocked + Pending + Used + Expired
```

## Queue Operations
- Operations queued via CustomerWalletJobProducer
- Jobs processed asynchronously by Agenda
- Retry on failure with exponential backoff
- Dead letter queue for permanently failed jobs
- Job status tracking for monitoring

## Key Workflows

### Add Points Flow
1. Initialize wallet if not exists
2. Queue add-pending job
3. Job processes: Create pocket, add transaction record
4. Update pendingBalance
5. Confirmation response

### Block & Debit Flow
1. Validate sufficient available balance
2. Queue block-points job
3. Deduct from available, add to blocked
4. Later: queue debit job
5. Move from blocked to used

### Auto-Expiry Flow
1. Scheduled job checks pocket expiry dates
2. Move expired pockets to expiredBalance
3. Update pockets status to EXPIRED
4. Notification to customer of expired points
5. Audit log entry

## Performance Considerations
- Wallet fetches include nested pockets (eager load) - consider pagination for large histories
- Balance updates use atomic Prisma operations
- Indexes on customerId and currencyCode for quick lookups
- Queue-based processing prevents blocking operations
- Consider caching wallet balance for read-heavy operations

## Notes
- All amounts use Decimal type for precision
- Wallet unique per (customer, currency) combination
- Pockets group transactions by earning event/campaign
- Transaction status separate from pocket status
- Queue retries configurable per environment
- Balance snapshots can be exported for auditing
- No manual balance manipulation without audit trail
