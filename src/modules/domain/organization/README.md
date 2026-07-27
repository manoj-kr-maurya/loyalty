# Organization Module

## Overview
The Organization Module manages the core business entities in the loyalty platform. Organizations (retailers, brands, merchants) create and manage their own loyalty programs, invite team members, manage currencies, campaigns, and customer interactions.

## Current State (Implemented Features)

### Organization Management
- **Create Organization**: Register new business entity with phone-based verification
- **Organization Authentication**: OTP-based login via phone number
- **Organization Profile**: Name, phone, country code, address, logo/image
- **Organization Verification**: Track verification status

### Organization Credentials
- **Invite System**: Invite shop owners/managers via phone number
- **Multi-Role Support**: ADMIN and SHOP roles within organization
- **Invite Management**: Create, track, and validate invites

### Organization Setup
- **Currency Management**: Create and manage custom loyalty currencies
- **Currency Buckets**: Initialize currency allocation
- **Campaign Setup**: Define loyalty campaigns
- **Metadata Flags**: Store custom organization settings

### Organization Data
- **Organization Details**: Fetch with currencies and campaigns
- **Organization Relationships**: Currencies, campaigns, customers, orders
- **Metadata Tracking**: Custom attributes per organization

### Authentication Flow
1. **Phone Entry**: Organization provides phone number
2. **Find/Create**: Check if organization exists, create if not
3. **OTP Generation**: Generate and send OTP via SMS/email
4. **OTP Validation**: Verify OTP matches
5. **JWT Generation**: Issue authentication token

## Database Models Used
- `Organization` - Core organization entity
- `OrganizationRoles` - Enum: ADMIN, SHOP, USER
- `Currency` - Organization's loyalty currencies
- `CurrencyBucket` - Currency allocation
- `OrganizationCampaign` - Campaigns
- `Invite` - Invitation records
- `MetaFlagsForOrganization` - Custom metadata
- `Customer` - Customers associated
- `CustomerOrganizationOrder` - Orders

## Dependencies
- `AuthService` - Authentication and JWT
- `CommonDBService` - Database queries
- `OrganizationPrismaHelperService` - Complex queries
- `ImgBBService` - Image uploads
- `PrismaService` - Database operations
- `MailAndSmsService` - Notifications
- `ConfigService` - Environment configuration

## Current Implementation Details

### Organization Structure
```typescript
{
  id: string,
  name: string,
  phoneNumber: string,
  countryCode: string,      // e.g., '+91'
  address?: string,
  logo?: string,            // ImgBB URL
  isVerified: boolean,
  createdAt: Date,
  updatedAt: Date,
  
  // Nested relations
  currencies?: Currency[],
  campaigns?: OrganizationCampaign[],
  customers?: Customer[],
  metaFlags?: MetaFlagsForOrganization[]
}
```

### Invite Structure
```typescript
{
  id: string,
  assignedTo: string,       // Phone number
  role: OrganizationRoles,  // ADMIN, SHOP
  organizationId?: string,
  orgAdminId?: string,
  generatedBy: string,
  createdAt: Date,
  expiresAt: Date,
  acceptedAt?: Date
}
```

## What They Want to Build (Future Goals)

### Phase 1: Organization Hierarchy
- [ ] Sub-organizations/branches support
- [ ] Parent-child organization relationships
- [ ] Multi-location organization management
- [ ] Location-specific campaigns
- [ ] Consolidated reporting across locations

### Phase 2: Team Management
- [ ] Team member profiles (name, role, permissions)
- [ ] Role-based access control (RBAC) expansion
- [ ] Permission matrix per role
- [ ] Activity audit logs per user
- [ ] Two-factor authentication for team

### Phase 3: KYC & Verification
- [ ] KYC document upload (GST, PAN, etc.)
- [ ] Verification workflow with admin approval
- [ ] Company registration validation
- [ ] Bank account verification
- [ ] Risk scoring

### Phase 4: Subscription & Billing
- [ ] Subscription tiers (free, pro, enterprise)
- [ ] Feature limits per tier
- [ ] Usage-based billing
- [ ] Invoice generation
- [ ] Payment integration

### Phase 5: Organization Settings
- [ ] Branding customization (colors, logo)
- [ ] Email/SMS configuration per org
- [ ] Notification preferences
- [ ] Reporting frequency
- [ ] Feature toggles

### Phase 6: Analytics & Dashboard
- [ ] Organization dashboard with KPIs
- [ ] Revenue metrics (active customers, spending)
- [ ] Campaign performance comparison
- [ ] Customer segmentation analysis
- [ ] Predictive analytics

### Phase 7: API & Integration
- [ ] API key generation for organizations
- [ ] Webhook support for events
- [ ] Third-party app marketplace
- [ ] Integration with POS systems
- [ ] Custom integration builder

### Phase 8: Compliance
- [ ] Terms of service acceptance
- [ ] Data residency compliance
- [ ] GDPR data export/deletion
- [ ] Regulatory compliance tracking
- [ ] Audit trail maintenance

## API Endpoints
```
POST   /organizations/register           - Register new organization
POST   /organizations/login/send-otp     - Request login OTP
POST   /organizations/login/verify-otp   - Verify OTP and login
GET    /organizations/:id                - Get organization details
PUT    /organizations/:id                - Update organization profile
POST   /organizations/:id/upload-logo    - Upload organization logo

POST   /organizations/:id/invite         - Invite team member
GET    /organizations/:id/invites        - List pending invites
POST   /invites/:id/accept               - Accept invitation
DELETE /invites/:id                      - Revoke invitation

GET    /organizations/:id/currencies     - List currencies
POST   /organizations/:id/currencies     - Create currency
GET    /organizations/:id/campaigns      - List campaigns
GET    /organizations/:id/customers      - List customers

GET    /organizations/:id/dashboard      - Dashboard metrics
```

## Status Codes & Error Handling
```
- InvalidAdminOrganizationException
- CurrencyBucketAlreadyInitialiedForThisOrganizationException
- CurrencyDoesNotExistsForThisOrganizationException
- WrongOrganizationOtpException
- PhoneNumberAlreadyVerifiedException
- OrganizationNotVerifiedException
- InviteExpiredException
```

## Workflow: Organization Onboarding

1. **Registration**
   - User enters phone, name, address
   - System creates organization
   - OTP sent to phone

2. **Verification**
   - User enters OTP
   - Organization marked verified
   - JWT token issued

3. **Setup**
   - Create loyalty currency
   - Initialize currency bucket
   - Define first campaign
   - Invite team members

4. **Go Live**
   - Set up POS integration
   - Configure notification templates
   - Test campaigns
   - Launch to customers

## Workflow: Invite Team Member

1. **Invite Creation**
   - Admin enters phone number + role
   - Invite record created with expiry
   - SMS/email sent to invitee

2. **Invitation Pending**
   - Invite valid for 7 days (configurable)
   - Can be revoked by admin
   - Can accept through mobile app

3. **Acceptance**
   - User clicks accept link
   - Account created with specified role
   - Added to organization team

## Database Constraints
- Unique Index: phoneNumber (organization)
- Unique Index: (phone, role) for invites
- Foreign Key: currencies.organizationId
- Foreign Key: campaigns.organizationId
- Check Constraint: phoneNumber format

## Image Handling (ImgBB)
- Logo upload to ImgBB cloud
- Image URL stored in database
- Automatic resizing/optimization
- CDN delivery for fast loading

## Performance Considerations
- Eager load currencies/campaigns for dashboard
- Paginate customer list
- Cache organization metadata
- Index on organizationId for all relations
- Consider archiving inactive organizations

## Security Notes
- OTP valid for 15 minutes (configurable)
- Phone number validated E.164 format
- Organizations can only access own data
- RBAC prevents unauthorized access
- All operations logged for audit

## Notes
- Organization phone must be unique
- Invite phone must be valid for SMS delivery
- Currency code limited to 3-4 characters
- Logo stored on ImgBB, not local storage
- Organization can have unlimited currencies/campaigns
- Team members inherit organization permissions
- Verify organization before enabling campaigns
