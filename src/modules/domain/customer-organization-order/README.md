# Customer-Organization-Order Module

## Overview
The Customer-Organization-Order Module manages the core transactional flow of the loyalty system. It tracks customer purchases/orders, calculates loyalty earnings, and coordinates currency burning and earning operations within the customer wallet system.

## Current State (Implemented Features)

### Order Creation
- **Create Order**: Record customer purchase/transaction with amount
- **Organization Context**: Track which organization order belongs to
- **Order Status Tracking**: Multiple status states throughout lifecycle

### Order Currency Handling
- **Burning Amount Details**: Track cash/money spent by customer
  - Associated with specific cash instrument
  - Amount in physical currency (INR)
  - Reference to coin being used
- **Earning Amount Details**: Track loyalty points earned
  - Percentage-based calculation from burning amount
  - Associated with loyalty coin/currency
  - Automatic calculation based on campaigns

### Order Processing Workflow
- **Status Transitions**: pending → processing → completed → reconciled
- **Transaction History**: Audit trail of all order state changes
- **Error Recovery**: Rollback mechanisms for failed transactions

### Order Querying & Filtering
- **Filter by Status**: pending, completed, etc.
- **Filter by Date Range**: Query orders within time window
- **Search by Order/Customer ID**: Full-text search capability
- **Pagination**: Sorted by creation date (newest first)

### Associated Data
- **Customer Details**: Reference to customer making order
- **Earning/Burning Breakdown**: Detailed amount calculations
- **Coin References**: Link to specific currency/coin types

## Database Models Used
- `CustomerOrganizationOrder` - Main order entity
- `CustomerEarningAmountDetail` - Points earned details
- `CustomerBurningAmountDetail` - Cash spent details
- `Coin` - Loyalty currency referenced
- `Cash` - Physical currency referenced
- `Customer` - Order customer
- `Organization` - Order organization

## Dependencies
- `PrismaService` - Database operations
- `CustomerWalletService` - Wallet balance updates
- `CampaignService` - Earning percentage calculation
- `MailAndSmsService` - Order confirmation notifications
- `Agenda` - Async job processing
- `CommonUtilsService` - Utility functions

## Current Implementation Details

### Order Structure
```typescript
{
  id: string,
  organizationId: string,
  customerId: string,
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "RECONCILED",
  createdAt: Date,
  updatedAt: Date,
  
  // Nested relations
  customerBurningAmountDetail?: {
    amount: Decimal,
    cash: { id, code, name },
    coin: { id, code, name }
  },
  customerEarningAmountDetail?: {
    amount: Decimal,
    coin: { id, code, name }
  }
}
```

### Burning Amount Detail
```typescript
{
  id: string,
  orderDetailId: string,
  amount: Decimal,           // Physical currency amount (INR)
  cashId: string,
  coinId: string,
  createdAt: Date
}
```

### Earning Amount Detail
```typescript
{
  id: string,
  orderDetailId: string,
  amount: Decimal,           // Loyalty points earned
  coinId: string,
  createdAt: Date
}
```

## What They Want to Build (Future Goals)

### Phase 1: Order Processing Workflow
- [ ] Implement state machine for order lifecycle
- [ ] Automatic status progression with configurable rules
- [ ] Order timeout handling (pending orders older than X days)
- [ ] Order retry logic for failed operations
- [ ] Transaction atomicity and rollback

### Phase 2: Advanced Earning Logic
- [ ] Dynamic earning calculation based on multiple campaigns
- [ ] Promotional multipliers (2x, 3x points)
- [ ] Tier-based earning (higher tiers earn more)
- [ ] Capped earnings per order/period
- [ ] Bonus point conditions

### Phase 3: Order Modifications
- [ ] Order cancellation workflow
- [ ] Refund processing with wallet reversal
- [ ] Order return/replacement handling
- [ ] Partial order fulfillment
- [ ] Exchange functionality

### Phase 4: Payment Integration
- [ ] PhonePe integration for payment processing
- [ ] Multiple payment method support
- [ ] Payment failure handling and retry
- [ ] Reconciliation with payment gateway
- [ ] Settlement reporting

### Phase 5: Advanced Analytics
- [ ] Order value breakdown (base + discount + points)
- [ ] Customer order frequency analysis
- [ ] Average order value tracking
- [ ] Peak ordering times detection
- [ ] Product-level analytics

### Phase 6: Fulfillment & Delivery
- [ ] Order fulfillment status tracking
- [ ] Shipping/delivery integration
- [ ] Estimated delivery calculation
- [ ] Tracking updates to customer
- [ ] Delivery confirmation

### Phase 7: Compliance & Auditing
- [ ] Order audit trail (who, what, when)
- [ ] Manual order adjustments with reason
- [ ] Dispute resolution workflow
- [ ] Chargeback handling
- [ ] Tax calculation and reporting

## API Endpoints
```
POST   /orders                      - Create order
GET    /orders/:id                 - Get order details
PUT    /orders/:id                 - Update order (admin only)
GET    /orders                     - List orders with filters

POST   /orders/:id/process         - Process pending order
POST   /orders/:id/complete        - Mark order complete
POST   /orders/:id/cancel          - Cancel order
POST   /orders/:id/refund          - Refund order

GET    /orders/search?term=...     - Search orders
GET    /organizations/:orgId/orders - Get org orders
GET    /customers/:custId/orders   - Get customer orders
```

## Status Codes & Error Handling
```
- PENDING: Order created, awaiting processing
- PROCESSING: Wallet transactions in progress
- COMPLETED: Order and wallet updates finished
- RECONCILED: Payment confirmed and settled

Errors:
- OrderNotFoundException
- InsufficientWalletBalanceException
- InvalidOrderStatusTransitionException
- PaymentFailedException
- OrderAlreadyCancelledException
```

## Database Indexes
- Index on (organizationId, status) for quick filtering
- Index on (customerId, createdAt) for customer order history
- Index on (status, updatedAt) for pending order processing
- Index on createdAt for time-based queries

## Queue Integration
- Order processing via Agenda job queue
- Async wallet updates for scalability
- Email notifications queued separately
- Payment reconciliation jobs scheduled

## Key Workflows

### Order Creation Flow
1. Validate customer, organization, amounts
2. Create order with PENDING status
3. Initialize earning/burning details
4. Queue async wallet update job
5. Send confirmation notification

### Order Processing Flow
1. Check order is in PENDING state
2. Validate wallet balance (burning amount)
3. Debit cash from wallet (burn)
4. Calculate earning amount from campaigns
5. Credit loyalty points (earn)
6. Update order status to COMPLETED
7. Send completion notification

### Order Cancellation Flow
1. Check order can be cancelled (status check)
2. Reverse earning credits
3. Refund burning amount
4. Update status to CANCELLED
5. Send cancellation notification

## Notes
- Decimal used for all currency amounts (prevent floating-point issues)
- Earning amount auto-calculated from campaign rules
- Burning amount is required, must be positive
- Each order creates separate earning/burning detail records
- Orders immutable after completion (admin override possible)
- Supports multiple currencies per organization
- Order processing atomic at database level
