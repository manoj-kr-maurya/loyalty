# Campaign Module

## Overview
The Campaign Module manages loyalty earning campaigns created by organizations. It defines how customers earn loyalty points/currency during specific time periods with percentage-based earning rates, currency allocation, and automated expiry management.

## Current State (Implemented Features)

### Campaign Management
- **Create Campaign**: Define earning campaign with start/end dates, organization, currency, earning percentage
- **Edit Campaign**: Update campaign parameters (excludes the campaign being edited from overlap checks)
- **Campaign Activation**: Enable/disable campaigns
- **Campaign Deletion**: Remove campaigns

### Campaign Validation
- **Date Overlap Detection**: Prevents multiple campaigns for same currency in overlapping date ranges
- **Currency Validation**: Ensures currency belongs to organization
- **Authorization Check**: Validates user has permission to create campaigns for organization
- **Wallet Balance Validation**: Ensures organization has sufficient currency for allocation

### Campaign Calculations
- **Potential Earnings**: Calculate what customer would earn from purchase with specific earning percentage
- **Earnings Per Campaign**: Compute total earnings from all applicable campaigns for an order

### Automated Job Scheduling
- **Campaign Expiry Reminders**: Agenda-based jobs to notify before campaign ends
- **Campaign Auto-Disable**: Automatically disable expired campaigns
- **Notification Queue**: Integration with agenda for scheduled reminders

## Database Models Used
- `OrganizationCampaign` - Campaign entity with dates, percentage, organization
- `Currency` - Loyalty currency for campaign
- `CurrencyBucket` - Currency allocation tracking
- `Organization` - Campaign owner
- `CustomerOrganizationOrder` - Orders affected by campaigns

## Dependencies
- `OrganizationService` - Validate organization and currencies
- `CommonUtilsService` - Utility functions
- `ConfigService` - Environment configuration
- `CampaignPrismaHelperService` - Complex Prisma queries
- `PrismaService` - Database operations
- `Agenda Service` - Job scheduling

## Current Implementation Details

### Campaign Overlap Check Logic
```
For each campaign in date range:
  1. Filter campaigns excluding target campaign ID
  2. For each existing campaign:
     - Check if new campaign start <= existing campaign end
     - AND new campaign end >= existing campaign start
     - If overlap detected, return overlappingCampaignName
  3. If no overlaps, return isOverlapping: false
```

### Campaign Structure
```typescript
{
  id: string,
  organizationId: string,
  startDate: Date,           // UTC timezone
  endDate: Date,             // UTC timezone
  earningPercentage: number, // e.g., 5 for 5%
  currencyCode: string,
  allocatedAmount: Decimal,
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED'
}
```

## What They Want to Build (Future Goals)

### Phase 1: Campaign Performance
- [ ] Real-time campaign metrics (earnings generated, customers reached)
- [ ] Campaign ROI calculation (allocation vs actual earnings)
- [ ] Customer participation rate per campaign
- [ ] Top earning customers per campaign
- [ ] Campaign effectiveness scoring

### Phase 2: Advanced Campaign Rules
- [ ] Tiered earning percentages (e.g., 5% for first $100, 10% for $100+)
- [ ] Category-based campaigns (earn more on specific product types)
- [ ] Customer segment targeting (VIP, new, inactive customers)
- [ ] Time-based multipliers (2x on weekends, etc.)
- [ ] Maximum earning caps per customer per campaign

### Phase 3: Campaign Automation
- [ ] Campaign scheduling with auto-create capability
- [ ] Recurring/recurring campaigns (weekly, monthly patterns)
- [ ] Conditional campaign activation (based on customer behavior)
- [ ] A/B testing for campaign effectiveness
- [ ] Recommendation engine for optimal earning percentages

### Phase 4: Budget & Allocation
- [ ] Campaign budget allocation and tracking
- [ ] Auto-replenishment when budget depletes
- [ ] Budget splitting across multiple campaigns
- [ ] Cost per acquisition calculations
- [ ] Budget optimization recommendations

### Phase 5: Campaign Analytics & Reporting
- [ ] Campaign comparison tools (side-by-side metrics)
- [ ] Historical campaign performance (archive)
- [ ] Trend analysis (earning rate changes over time)
- [ ] Predictive analytics (forecast campaign impact)
- [ ] Export campaign reports

### Phase 6: Holiday & Seasonal Campaigns
- [ ] Pre-built holiday campaign templates
- [ ] Seasonal campaign recommendations
- [ ] Flash sales with time-limited campaigns
- [ ] Event-based campaign triggers

## API Endpoints
```
POST   /campaigns                    - Create campaign
PUT    /campaigns/:id               - Edit campaign
GET    /campaigns/:id               - Get campaign details
DELETE /campaigns/:id               - Delete campaign
GET    /campaigns/:id/potential-earnings  - Calculate potential earnings
GET    /campaigns                   - List campaigns (with filters)

POST   /campaigns/activate/:id      - Activate campaign
POST   /campaigns/deactivate/:id    - Deactivate campaign
```

## Error Handling
```
- OverlappingCampaignsNotAllowedException
- InvalidOrganizationException
- InvalidCurrencyException
- CurrencyBucketNotFoundException
- NotAuthorisedToCreateCampaignException
- NotEnoughCurrencyWalletBalanceException
```

## Database Queries Optimization
- Uses Promise.all() for parallel queries where possible
- Campaign overlap checks are O(n) - consider indexing on organizationId, startDate, endDate
- Consider caching campaign data for read-heavy operations

## Job Scheduling Integration
- Agenda-based job producer for campaign expiry reminders
- Jobs persisted in MongoDB for reliability
- Automatic job cleanup after execution

## Notes
- All campaign dates stored in UTC
- Earning percentage stored as number (e.g., 5 for 5%)
- Campaign overlap validation excludes current campaign during edit
- Currency bucket must have sufficient balance for campaign allocation
- Campaign status transitions: ACTIVE → EXPIRED → INACTIVE (manual or automatic)
