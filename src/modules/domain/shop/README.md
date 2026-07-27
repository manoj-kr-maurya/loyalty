# Shop Module

## Overview
The Shop Module represents subordinate retail locations or franchise points within an organization. Shops are point-of-sale entities that operate under an admin organization, processing customer transactions and redeeming loyalty points at the checkout level.

## Current State (Implemented Features)

### Shop Management
- **Create Shop**: Register new retail location under organization
- **Shop Profile**: Store location details, address, contact info
- **Shop Activation**: Enable/disable shop for transactions
- **Shop Listing**: Retrieve all shops under organization

### Shop Identity & Configuration
- **Unique Shop Code**: Identifier for POS integration
- **Shop Location**: Address and geographic data
- **Contact Information**: Phone, email for shop
- **Shop Manager**: Team member managing shop
- **Operating Hours**: Business hours configuration

### Transaction Context
- **POS Integration**: Point-of-sale system integration
- **Terminal Assignment**: Multiple terminals per shop
- **Transaction Processing**: Process customer purchases
- **Receipt Printing**: Generate transaction receipts

## Database Models Used
- `Shop` - Shop entity
- `Organization` - Parent organization
- `POSTerminal` - Payment terminals at shop
- `ShopTransaction` - Transactions at shop
- `Customer` - Customers visiting shop

## Dependencies
- `OrganizationService` - Parent organization validation
- `PrismaService` - Database operations
- `Logger` - Error logging
- `ConfigService` - Environment configuration

## Current Implementation Details

### Shop Structure
```typescript
{
  id: string,
  organizationId: string,
  name: string,
  shopCode: string,         // Unique identifier for POS
  address: string,
  city: string,
  state: string,
  pinCode: string,
  phoneNumber: string,
  email?: string,
  managerId: string,        // Shop manager user ID
  
  // Configuration
  operatingHoursStart: string,  // HH:mm format
  operatingHoursEnd: string,
  timezone: string,
  
  // Status
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Shop Roles & Permissions
```
Organization (ADMIN)
├── Shop Manager (SHOP_MANAGER)
│   └── Shop Staff (CASHIER, ASSOCIATE)
└── Shop (SHOP) [deprecated role]
```

## What They Want to Build (Future Goals)

### Phase 1: Shop Management
- [ ] Shop hierarchy (head office, regional, store)
- [ ] Shop transfer history (staff reassignment)
- [ ] Multi-user management per shop
- [ ] Shop performance dashboard
- [ ] Shop inventory tracking

### Phase 2: POS Integration
- [ ] REST API for POS systems
- [ ] Transaction sync with loyalty
- [ ] Real-time balance check
- [ ] Receipt integration
- [ ] Offline mode support

### Phase 3: Transactions & Loyalty
- [ ] Point-of-sale transaction flow
- [ ] Manual point redemption
- [ ] Promotional application at POS
- [ ] Receipt customization
- [ ] Transaction failure handling

### Phase 4: Analytics & Reporting
- [ ] Shop-level sales metrics
- [ ] Hourly/daily/monthly reports
- [ ] Staff performance metrics
- [ ] Customer visit frequency per shop
- [ ] Transaction trending

### Phase 5: Configuration
- [ ] Terminal management
- [ ] Receipt templates
- [ ] Discount configuration
- [ ] Operating hours
- [ ] Holiday calendar

### Phase 6: Security & Compliance
- [ ] User access control per shop
- [ ] Transaction audit logs
- [ ] PCI compliance
- [ ] Data retention policies
- [ ] Reconciliation tools

### Phase 7: Operations
- [ ] Shift management
- [ ] Cash register balancing
- [ ] Till reconciliation
- [ ] Daily closing report
- [ ] Staff clocking in/out

### Phase 8: Integration
- [ ] Third-party POS systems
- [ ] Inventory management systems
- [ ] E-commerce integration
- [ ] CRM system integration
- [ ] Accounting software integration

## API Endpoints
```
POST   /organizations/:orgId/shops              - Create shop
GET    /organizations/:orgId/shops              - List shops
GET    /organizations/:orgId/shops/:shopId      - Get shop details
PUT    /organizations/:orgId/shops/:shopId      - Update shop
DELETE /organizations/:orgId/shops/:shopId      - Delete shop

POST   /organizations/:orgId/shops/:shopId/activate    - Activate shop
POST   /organizations/:orgId/shops/:shopId/deactivate  - Deactivate shop

GET    /shops/:shopId/transactions             - List transactions
POST   /shops/:shopId/transactions              - Create transaction
GET    /shops/:shopId/reports                  - Shop reports

GET    /shops/:shopId/terminals                - List POS terminals
POST   /shops/:shopId/terminals                - Register terminal
```

## Error Handling
```
- ShopNotFoundException
- InvalidShopCodeException (duplicate)
- InvalidOrganizationException (parent)
- ShopNotActiveException
- ShopAlreadyExistsException
- ShopTransactionFailedException
- InvalidTerminalException
```

## Configuration
- Shop code must be unique per organization
- Operating hours in 24-hour format
- Timezone validation (IANA timezone)
- Phone number E.164 format
- Email optional but validated if provided

## Database Constraints
- Unique Index: (organizationId, shopCode)
- Unique Index: (organizationId, name) optional
- Foreign Key: organizationId → Organization
- Check Constraint: operatingHoursStart < operatingHoursEnd

## Transaction Flow at Shop

1. **Customer Arrives**
   - Check-in via loyalty program
   - Retrieve loyalty wallet
   - Display balance to cashier

2. **Transaction Processing**
   - Scan/enter customer phone
   - Add items to transaction
   - Apply applicable promotions
   - Cashier applies discounts if available

3. **Point Redemption**
   - Suggest point redemption
   - Customer approves redemption amount
   - System deducts points from wallet
   - Applies to transaction total

4. **Payment & Receipt**
   - Process payment
   - Print receipt with points earned
   - Confirm transaction completion
   - Update customer wallet

## POS API Design

### Terminal Registration
```
POST /shops/{shopId}/terminals
{
  "terminalId": "POS001",
  "model": "Nexgo N5",
  "serialNumber": "ABC123XYZ"
}
```

### Transaction Submission
```
POST /shops/{shopId}/transactions
{
  "terminalId": "POS001",
  "customerId": "CUST123",
  "amount": 5000,
  "pointsRedeem": 500,
  "paymentMethod": "CARD",
  "items": [...]
}
```

### Real-Time Balance Check
```
GET /shops/{shopId}/customer/{customerId}/balance?currencyCode=PTS
{
  "available": 2500,
  "blocked": 100,
  "pending": 50,
  "total": 2650
}
```

## Performance Considerations
- Cache shop details in Redis
- Index on organizationId for list queries
- Batch transaction sync
- Async receipt generation
- Consider horizontal scaling for multi-shop chains

## Security Notes
- API authentication for POS terminals
- Request signing for transaction integrity
- PCI DSS compliance for payment data
- Encrypted communication
- Rate limiting on API endpoints

## Notes
- Shop code used for POS system integration
- One shop manager per shop recommended
- Shops inherit organization settings
- Shops can have multiple terminals
- Transactions logged for audit
- Shop-level analytics separate from org-level
- Consider franchise model for multi-unit shops
