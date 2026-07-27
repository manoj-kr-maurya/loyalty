# Admin Module

## Overview
The Admin Module serves as a centralized dashboard for system administrators to manage all organizations, customers, and loyalty ecosystem entities. It provides comprehensive read operations, filtering, pagination, and administrative actions across the platform.

## Current State (Implemented Features)

### Organization Management
- **Fetch All Organizations**: Paginated list with search by name, phone number, or address
- **Fetch Organization by ID**: Retrieve full organization details including currencies and metadata flags
- **View Organization Campaigns**: List all campaigns for a specific organization
- **View Organization Currencies**: Get unified currency data with exchange rates and bucket information

### Customer Management
- **Fetch All Customers**: Paginated list with search by name or phone number
- **Fetch Customer by ID**: Retrieve customer profile with metadata
- **View Customer Wallets**: Get all wallet instances for a customer with pocket and transaction history
- **View Customer Orders**: Filter orders by status, date range, search term

### Order Management
- **Organization Customer Orders**: Filter customer orders at organization level
- **Customer Orders**: Filter customer orders at individual level
- Both support filtering by: status, date range (dateFrom/dateTo), and search terms

### Admin Operations
- **Invite Admin**: Create admin invitations with phone number and location

### Query Capabilities
- Pagination: page, limit parameters (default: page=1, limit=10)
- Search: Case-insensitive search on relevant fields
- Filtering: Status, date range filters
- Sorting: Default descending by createdAt

## Database Models Used
- `Organization` - with related currencies and metaFlags
- `Customer` - with related metaFlags
- `OrganizationCampaign`
- `Currency` & `CurrencyBucket`
- `CustomerWallet` - with nested pockets and transactions
- `CustomerOrganizationOrder` - with earning/burning details
- `Invite`

## Dependencies
- **PrismaService**: Database operations
- **Pagination Utils**: getPaginationMetadata for consistent pagination format

## What They Want to Build (Future Goals)

### Phase 1: Enhanced Analytics
- [ ] Organization performance metrics (active customers, total earnings, campaign ROI)
- [ ] Customer lifecycle metrics (acquisition, retention, churn)
- [ ] Revenue analytics (currency distributed vs used)
- [ ] Campaign performance comparison

### Phase 2: Bulk Operations
- [ ] Bulk organization status updates
- [ ] Bulk customer eligibility changes
- [ ] Bulk campaign configuration updates
- [ ] Bulk wallet adjustments with audit trail

### Phase 3: Advanced Admin Controls
- [ ] Organization tier/plan management
- [ ] Subscription management and billing
- [ ] Role-based access control refinement
- [ ] Admin audit logs with user action tracking
- [ ] System-wide settings configuration
- [ ] Feature flags and toggles

### Phase 4: Reporting & Export
- [ ] Export organization data (CSV/Excel)
- [ ] Export customer records with wallet snapshots
- [ ] Generate campaign performance reports
- [ ] Order history exports

### Phase 5: Troubleshooting & Support
- [ ] View customer wallet history/audit trail
- [ ] Manual transaction adjustments with reason tracking
- [ ] Customer account reset/recovery
- [ ] Organization data reconciliation tools

## API Endpoints
```
GET  /admin/organizations           - List all organizations with pagination
GET  /admin/organizations/:id       - Get organization details
GET  /admin/organizations/:id/campaigns    - Get org campaigns
GET  /admin/organizations/:id/currencies   - Get org currencies
GET  /admin/organizations/:id/orders       - Get org customer orders

GET  /admin/customers              - List all customers with pagination
GET  /admin/customers/:id          - Get customer details
GET  /admin/customers/:id/wallets  - Get customer wallets
GET  /admin/customers/:id/orders   - Get customer orders

POST /admin/invites                - Invite new admin
```

## Error Handling
- `NotFoundException` - When organization or customer not found
- Returns structured response with status code and error message

## Notes
- All pagination defaults to page=1, limit=10
- Search is case-insensitive using Prisma `mode: 'insensitive'`
- Orders include nested earning/burning details with coin/cash associations
- Wallet retrieval includes full transaction history per pocket
