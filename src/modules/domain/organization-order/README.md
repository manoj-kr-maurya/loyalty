# Organization-Order Module

## Overview
The Organization-Order Module manages currency purchase orders created by organizations. It handles the process where organizations buy loyalty currency from the platform to fund their campaigns and customer rewards programs.

## Current State (Implemented Features)

### Order Management
- **Create Currency Order**: Organization purchases loyalty currency
- **Order Status Tracking**: Track purchase progression from pending to fulfilled
- **Order History**: Retrieve organization's purchase history
- **Order Details**: View order amount, currency, organization details

### Currency Purchase Flow
- **Amount Specification**: Define how much currency to purchase
- **Currency Selection**: Choose which organization currency to purchase
- **Organization Verification**: Validate organization and payment capability
- **Order Confirmation**: Generate purchase order

### Bulk Organization Orders
- **Multi-Order Retrieval**: List all orders for organization with filtering
- **Date Filtering**: Query orders within date ranges
- **Status Filtering**: Filter by order status (pending, completed, etc.)
- **Amount Filtering**: Search/filter by purchase amount

## Database Models Used
- `OrganizationOrder` - Purchase order entity
- `Organization` - Purchasing organization
- `Currency` - Currency being purchased
- `CurrencyBucket` - Destination bucket

## Dependencies
- `PrismaService` - Database operations
- `OrganizationService` - Organization validation
- `CurrencyService` - Currency validation
- `PaymentService` - Payment processing
- `MailAndSmsService` - Order notifications
- `Agenda` - Async order processing

## Current Implementation Details

### Organization Order Structure
```typescript
{
  id: string,
  organizationId: string,
  currencyCode: string,
  amount: Decimal,          // Purchase quantity
  amountINR: Decimal,       // Purchase cost in INR
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
  paymentMethod: "WALLET" | "PHONEPE" | "BANK_TRANSFER",
  paymentReference?: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Order Status Transitions
```
PENDING → PROCESSING → COMPLETED
                    ↓
                   FAILED (with refund)
```

## What They Want to Build (Future Goals)

### Phase 1: Payment Processing
- [ ] PhonePe payment gateway integration
- [ ] Multiple payment method support (card, UPI, wallet)
- [ ] Payment failure handling with retry
- [ ] Refund processing
- [ ] Invoice generation

### Phase 2: Order Management
- [ ] Bulk order creation
- [ ] Order scheduling (auto-purchase on low balance)
- [ ] Order modification/cancellation
- [ ] Partial fulfillment
- [ ] Order tracking with notifications

### Phase 3: Pricing & Discounts
- [ ] Volume-based pricing (buy more, pay less)
- [ ] Promotional discounts
- [ ] Custom pricing per organization
- [ ] Price quote generation
- [ ] Pricing history

### Phase 4: Fulfillment Automation
- [ ] Auto-fulfill orders on payment confirmation
- [ ] Automatic currency bucket top-up
- [ ] Refund processing on cancellation
- [ ] Order completion notifications
- [ ] Digital delivery confirmation

### Phase 5: Account Management
- [ ] Credit lines for organizations
- [ ] Payment terms (net 30, etc.)
- [ ] Recurring billing
- [ ] Invoice delivery (email)
- [ ] Payment history export

### Phase 6: Analytics & Reporting
- [ ] Organization spending trends
- [ ] Revenue forecasting
- [ ] Customer acquisition cost per org
- [ ] ROI per currency purchase
- [ ] Churn prediction

### Phase 7: Reconciliation
- [ ] Payment reconciliation
- [ ] Billing reconciliation
- [ ] Dispute resolution
- [ ] Manual order adjustments
- [ ] Audit trail

### Phase 8: Advanced Features
- [ ] Order automation rules (auto-reorder when low)
- [ ] Batch order processing
- [ ] Order consolidation
- [ ] Multi-currency pricing
- [ ] Rate locking for price protection

## API Endpoints
```
POST   /organizations/:orgId/orders              - Create purchase order
GET    /organizations/:orgId/orders              - List organization orders
GET    /organizations/:orgId/orders/:id          - Get order details
PUT    /organizations/:orgId/orders/:id          - Update order
DELETE /organizations/:orgId/orders/:id          - Cancel order

POST   /organizations/:orgId/orders/:id/pay      - Process payment
POST   /organizations/:orgId/orders/:id/confirm  - Confirm order completion
GET    /organizations/:orgId/orders/:id/invoice  - Download invoice

GET    /admin/orders                             - List all orders (admin)
PUT    /admin/orders/:id                         - Modify order (admin)
```

## Status Codes & Error Handling
```
- OrderNotFoundException
- InsufficientPaymentException (not enough balance)
- InvalidCurrencyException (currency not found)
- PaymentFailedException (payment processing failed)
- OrderAlreadyCompletedException (can't modify)
- OrderAlreadyCancelledException (can't process)
```

## Workflow: Currency Purchase Order

1. **Order Creation**
   - Organization specifies currency code and amount
   - System calculates INR cost based on exchange rate
   - Order created with PENDING status
   - Confirmation sent to organization

2. **Payment Processing**
   - Organization selects payment method
   - Payment gateway initiated (PhonePe, etc.)
   - Validate payment authorization
   - Update order status to PROCESSING

3. **Order Fulfillment**
   - Validate payment received
   - Add purchased currency to organization bucket
   - Update order status to COMPLETED
   - Send completion notification

4. **Order History**
   - Track total currency purchased
   - Calculate spending trends
   - Export for accounting

## Pricing Calculation

```
Price = Amount × Rate + Processing Fee

Example:
- Buy: 10,000 POINTS
- Rate: ₹0.10 per point
- Cost: 10,000 × ₹0.10 = ₹1,000
- Fee: ₹50 (5%)
- Total: ₹1,050
```

## Database Indexes
- Index: (organizationId, createdAt) for org order listing
- Index: (status, createdAt) for pending order processing
- Index: (organizationId, status) for quick status filtering
- Unique Index: none (multiple orders allowed)

## Integration Points

### PhonePe Integration
- Payment initiation
- Callback handling (success/failure)
- Refund processing
- Settlement reporting

### Currency Service
- Exchange rate lookup
- Bucket top-up
- Balance validation

### Notification Service
- Order creation confirmation
- Payment success notification
- Order completion notification
- Invoice delivery

## Security Considerations
- Validate organization owns order
- Verify payment authenticity
- PCI compliance for payment data
- Secure token storage
- Encryption for sensitive fields

## Performance Optimization
- Cache exchange rates
- Index organization/status queries
- Batch process completed orders
- Archive old orders

## Notes
- Currency purchases permanent once completed
- No partial refunds after completion
- Order creation does not deduct currency immediately
- Payment processing happens asynchronously
- Invoice generated after payment confirmation
- Organizations can view own orders only
- Admin can view/manage all orders
