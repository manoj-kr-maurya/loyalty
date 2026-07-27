# Listener Module

## Overview
The Listener Module implements event-driven architecture patterns for handling asynchronous events and webhooks in the loyalty platform. It provides event listeners, handlers, and emitters for decoupled service communication.

## Current State (Implemented Features)

### Event System
- **Event Emission**: Publish events from business operations
- **Event Listeners**: Subscribe to specific events
- **Async Handlers**: Non-blocking event processing
- **Event Routing**: Route events to appropriate handlers

### Event Types
- **Customer Events**: Customer created, verified, updated
- **Campaign Events**: Campaign started, ended, modified
- **Order Events**: Order created, completed, failed
- **Wallet Events**: Points added, spent, expired
- **Organization Events**: Organization created, updated

### PostgreSQL Listener
- **LISTEN/NOTIFY**: PostgreSQL pub/sub implementation
- **Channel Subscription**: Subscribe to database events
- **Event Payload**: Pass data through notification
- **Connection Management**: Maintain listener connections

## Dependencies
- `RxJS` - Event stream handling
- `PrismaService` - Database operations
- `Logger` - Event logging
- `EventEmitter2` (optional) - Advanced event patterns

## Current Implementation Details

### Event Structure
```typescript
interface Event {
  type: string,              // e.g., 'customer.created'
  aggregate: string,         // e.g., 'Customer'
  aggregateId: string,
  timestamp: Date,
  version: number,
  payload: {
    [key: string]: any
  },
  userId?: string,
  correlationId?: string
}
```

### Event Examples

#### Customer Created Event
```typescript
{
  type: 'customer.created',
  aggregate: 'Customer',
  aggregateId: 'CUST123',
  timestamp: '2024-01-15T10:30:00Z',
  version: 1,
  payload: {
    name: 'John Doe',
    phoneNumber: '9876543210',
    email: 'john@example.com'
  }
}
```

#### Order Completed Event
```typescript
{
  type: 'order.completed',
  aggregate: 'Order',
  aggregateId: 'ORD456',
  timestamp: '2024-01-15T10:30:00Z',
  version: 1,
  payload: {
    customerId: 'CUST123',
    organizationId: 'ORG789',
    amount: 5000,
    pointsEarned: 500
  }
}
```

## What They Want to Build (Future Goals)

### Phase 1: Event Sourcing
- [ ] Event store implementation
- [ ] Event replay capability
- [ ] Snapshot strategy
- [ ] Event versioning
- [ ] Event migration

### Phase 2: Webhook System
- [ ] Outbound webhook delivery
- [ ] Webhook retry logic
- [ ] Webhook event filtering
- [ ] Webhook management UI
- [ ] Webhook delivery tracking

### Phase 3: Message Queue Integration
- [ ] RabbitMQ integration
- [ ] Apache Kafka support
- [ ] Message serialization
- [ ] Dead letter queues
- [ ] Message ordering guarantees

### Phase 4: Advanced Patterns
- [ ] Saga pattern for distributed transactions
- [ ] Process manager pattern
- [ ] CQRS implementation
- [ ] Event projection
- [ ] Event aggregation

### Phase 5: Observability
- [ ] Event tracing
- [ ] Event flow visualization
- [ ] Performance metrics per event type
- [ ] Anomaly detection
- [ ] Event replay debugging

### Phase 6: Integration Patterns
- [ ] Third-party webhook consumption
- [ ] Event polling fallback
- [ ] Webhook signature verification
- [ ] Event transformation
- [ ] Protocol adapters (HTTP, WebSocket)

### Phase 7: Resilience
- [ ] Idempotent event handlers
- [ ] Exponential backoff retries
- [ ] Circuit breaker for slow handlers
- [ ] Timeout handling
- [ ] Error recovery

### Phase 8: Analytics
- [ ] Event metrics
- [ ] Flow analysis
- [ ] Bottleneck identification
- [ ] Performance optimization
- [ ] Business intelligence integration

## API Endpoints
```
POST   /webhooks                     - Register webhook
GET    /webhooks                     - List webhooks
DELETE /webhooks/:id                 - Delete webhook
PUT    /webhooks/:id                 - Update webhook
GET    /webhooks/:id/deliveries      - Get delivery history
POST   /webhooks/:id/test            - Send test event
POST   /webhooks/:id/replay          - Replay past events

GET    /events                       - List events (audit)
GET    /events/:type                 - Events of specific type
POST   /events/search                - Search events
```

## Event Subscription Example

```typescript
// Subscribe to customer creation
this.eventListener.on('customer.created', async (event) => {
  const { aggregateId, payload } = event;
  // Create wallet for new customer
  await this.walletService.initialize(
    aggregateId,
    'DEFAULT_CURRENCY'
  );
});

// Subscribe to order completion
this.eventListener.on('order.completed', async (event) => {
  const { payload } = event;
  // Send confirmation email
  await this.notificationService.sendOrderComplete(payload);
});
```

## Webhook Configuration

```typescript
interface WebhookConfig {
  url: string,
  events: string[],           // e.g., ['customer.created', 'order.completed']
  secret?: string,            // For HMAC signature
  active: boolean,
  retryPolicy: {
    maxRetries: number,
    backoffMultiplier: number,
    initialDelay: number
  }
}
```

## Error Handling

```
- EventHandlerException (handler failure)
- EventEmitException (emit failure)
- WebhookDeliveryException (webhook failure)
- EventStoreException (storage failure)
- ListenerConnectionException (connection error)
```

## Event Types Reference

### Customer Events
- `customer.created` - New customer registered
- `customer.verified` - Customer phone verified
- `customer.updated` - Customer profile updated
- `customer.deleted` - Customer account deleted

### Campaign Events
- `campaign.created` - New campaign created
- `campaign.started` - Campaign started
- `campaign.ended` - Campaign ended
- `campaign.updated` - Campaign details updated

### Order Events
- `order.created` - Order placed
- `order.processing` - Order processing
- `order.completed` - Order completed
- `order.cancelled` - Order cancelled
- `order.failed` - Order failed

### Wallet Events
- `wallet.created` - Wallet created
- `wallet.credited` - Points added
- `wallet.debited` - Points spent
- `wallet.expired` - Points expired
- `wallet.blocked` - Points blocked

### Organization Events
- `organization.created` - Organization registered
- `organization.verified` - Organization verified
- `organization.updated` - Organization updated
- `organization.upgraded` - Plan upgraded

## Webhook Signature Verification

```typescript
// Incoming webhook request
const signature = req.headers['x-webhook-signature'];
const body = req.body;

// Verify signature
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(body))
  .digest('hex');

if (signature !== expectedSignature) {
  throw new InvalidSignatureException();
}
```

## Event Storage

### Event Store Schema
```typescript
{
  id: string,
  aggregateType: string,
  aggregateId: string,
  eventType: string,
  version: number,
  payload: object,
  metadata: {
    userId: string,
    ipAddress: string,
    timestamp: Date
  },
  createdAt: Date
}
```

## Monitoring & Metrics

### Prometheus Metrics
```
events_published_total{event_type="customer.created"} 1000
events_failed_total{event_type="order.completed"} 5
event_processing_duration_seconds{event_type="wallet.credited"} 0.123
webhooks_delivered_total{status="success"} 5000
webhooks_failed_total{status="failed"} 10
```

## Best Practices

### Event Design
- Use past tense for event names (created, updated)
- Include all data needed to handle event
- Version events for schema evolution
- Make events immutable
- Use correlation IDs for tracing

### Handler Design
- Make handlers idempotent
- Implement error handling
- Use timeouts to prevent hanging
- Log events for debugging
- Monitor handler performance

### Webhook Implementation
- Verify webhook signatures
- Implement retry logic
- Handle out-of-order events
- Provide webhook replay
- Track delivery status

## Integration Patterns

### Saga Pattern
```
Order Placed
  ↓ emit: order.created
Customer Wallet Handler
  ↓ emit: wallet.debited
Payment Handler
  ↓ emit: payment.processed
Fulfillment Handler
  ↓ emit: order.completed
```

### Process Manager
```
Listens to: customer.created
  ├─ Start email verification
  ├─ Create default wallet
  ├─ Send welcome offer
  └─ Update CRM
```

## Performance Considerations
- Async handlers prevent blocking
- Connection pooling for listeners
- Batch event processing where possible
- Index event store for quick queries
- Archive old events

## Scaling Considerations
- Partition events by aggregate ID
- Horizontal scaling with load balancer
- Message queue for event buffering
- Consumer groups for parallel processing
- Snapshot strategy for large event streams

## Notes
- Events are immutable records
- Event handlers execute asynchronously
- Webhooks subject to delivery constraints
- Event replay available for debugging
- Correlation IDs link related events
- Event sourcing provides complete audit trail
