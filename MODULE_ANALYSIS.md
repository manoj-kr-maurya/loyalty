# JAS Loyalty Engine Micro - Comprehensive Module Analysis

**Project Type**: NestJS-based Microservice for Loyalty Program Management  
**Database**: PostgreSQL with Prisma ORM  
**Cache**: Redis  
**Job Queue**: Agenda  

---

## Table of Contents

1. [Domain Modules](#domain-modules)
   - [Admin](#admin-module)
   - [Auth](#auth-module)
   - [Campaign](#campaign-module)
   - [Currency](#currency-module)
   - [Customer](#customer-module)
   - [Customer-Organization-Order](#customer-organization-order-module)
   - [Customer-Wallets](#customer-wallets-module)
   - [Mail-and-SMS](#mail-and-sms-module)
   - [Organization](#organization-module)
   - [Organization-Order](#organization-order-module)
   - [Shop](#shop-module)

2. [Core Modules](#core-modules)
   - [Factor2 (SMS)](#factor2-module)
   - [ImgBB (Image Upload)](#imgbb-module)
   - [PhonePe (Payment)](#phonepe-module)

3. [Infrastructure Modules](#infrastructure-modules)
   - [Health Check](#health-check-module)

---

## Domain Modules

---

### Admin Module

**File Location**: `src/modules/domain/admin/`

#### Purpose
Provides administrative dashboard and management capabilities for system-wide operations including organization and customer management.

#### Features Implemented
- Fetch all organizations with pagination and search
- Fetch all customers with pagination and search
- Fetch organization details by ID with currencies, campaigns, and metadata
- Invite admins to organizations
- Manage admin access and roles

#### Database Models Used
- `Organization` - Organizations with their metadata
- `Customer` - Customers in the system
- `OrganizationCampaign` - Campaigns owned by organizations
- `Currency` - Organization currencies
- `MetaFlagsForOrganization` - Organization onboarding flags

#### API Endpoints
- `GET /admin/fetch-all-organizations` - Paginated list of organizations
- `GET /admin/fetch-all-customers` - Paginated list of customers
- `GET /admin/fetch-organization/:id` - Organization details with full hierarchy
- `POST /admin/invite-admin` - Send invite to admin

#### Dependencies
- **PrismaService**: Direct database access
- No external module dependencies

#### DTOs & Data Structures
- `PaginationQueryDto` - Pagination parameters (page, limit, search)
- `OrganizationResponseDto` - Organization response format
- `CustomerResponseDto` - Customer response format
- `InviteAdminForm` - Form for admin invitation

#### Error Handling
- Standard NestJS exceptions
- No custom error codes defined

#### Key Services
- `AdminService.fetchAllOrganizations()` - Organizations with search/pagination
- `AdminService.fetchAllCustomers()` - Customers with search/pagination

---

### Auth Module

**File Location**: `src/modules/domain/auth/`

#### Purpose
Handles authentication for organizations and customers using OTP-based (phone/email) and JWT token generation. Manages session validation and rate limiting.

#### Features Implemented
- JWT generation with 14-day expiry
- JWT verification with session validation
- OTP generation and validation (environment-aware)
- Single-device login (session validation via cache)
- Rate limiting for OTP attempts
- Environment-based testing OTP (123456 for dev/test)
- Cache-based session management

#### Database Models Used
- `Organization` - Organizations being authenticated
- `Customer` - Customers being authenticated

#### Dependencies
- **JwtModule** (NestJS) - JWT token management
- **MailAndSmsModule** - For OTP delivery
- **CacheManager** - For session storage and rate limiting
- **CommonUtilsService** - Utility functions

#### DTOs & Data Structures
```typescript
// JWT Payload
{
  sub: entityId,
  sessionId: UUID,
  userType: 'Organization' | 'Customer'
}
```

#### Error Handling
- `InvalidJWTException` - Invalid or expired JWT
- `InvalidSessionException` - Session mismatch
- `TooManyAttemptsException` - Rate limiting

#### Key Services
- `AuthService.generateJWT()` - Creates JWT with session tracking
- `AuthService.verifyJWT()` - Validates JWT and session
- `AuthService.generateAndSaveOtp()` - Generates OTP with environment checks
- `AuthService.validateLoginOtp()` - OTP validation with rate limiting

#### Exports
- `JwtModule` - For use in other modules
- `AuthService` - For OTP and JWT operations

---

### Campaign Module

**File Location**: `src/modules/domain/campaign/`

#### Purpose
Manages organization-level campaigns that define earning rules for customer transactions. Campaigns specify earning percentages for specific currencies during date ranges.

#### Features Implemented
- Create campaigns with date range and earning percentage
- Validate campaign date overlap prevention
- Check organization has sufficient currency balance
- Validate currency availability for organization
- Fetch active campaigns for earning calculations
- Campaign deletion (soft delete)
- Get campaigns for organization
- Get specific campaign details
- Update existing campaigns

#### Database Models Used
- `OrganizationCampaign` - Campaign definitions
  - `id`, `organizationId`, `name`, `earningPercentage`, `currencyCode`
  - `startDate`, `endDate`, `isSoftDeleted`, `earningExpiresIn`
- `Currency` - Organization currencies
- `CurrencyBucket` - Organization currency balance

#### API Endpoints
- `POST /campaign/create-organization-level-campaign` - Create campaign
- `GET /campaign/get-organization-level-campaigns` - List all campaigns
- `GET /campaign/get-organization-level-campaign/:id` - Get specific campaign
- `POST /campaign/update-organization-level-campaign` - Update campaign

#### Dependencies
- **OrganizationModule** - Organization validation and currency checks
- **CurrencyModule** - Currency information
- **AuthModule** - JWT verification
- **AgendaModule** - Campaign expiry job scheduling
- **CacheModule** - Caching for campaigns
- **ImgBBModule** - Image uploads for campaign banners

#### Jobs/Async Work
- **Campaign Expiry Reminders** - Scheduled via Agenda:
  - Initial reminder: X days before expiry (configurable)
  - Followup 1: 3 days before expiry
  - Followup 2: 1 day before expiry
  - Final: On expiry day
- Job names: `CAMPAIGN_EXPIRY_REMINDER_*`

#### DTOs & Data Structures
```typescript
CreateOrEditOrganizationCampaignForm {
  id?: string (optional for update)
  name: string
  earningPercentage: number (e.g., 2 for 2%)
  currencyCode: string
  startDate: Date (MM-DD-YYYY format)
  endDate: Date (MM-DD-YYYY format)
  force?: boolean (force activate overlapping)
}

EarningsPerCampaign {
  campaignId: string
  earningPercentage: number
}

PotentialEarningForm {
  realAmount: number
  organizationId: string
}
```

#### Exceptions
- `OverlappingCampaignsNotAllowedException` - Campaigns overlap in date ranges
- `NotEnoughCurrencyWalletBalanceException` - Insufficient currency balance
- `NotAuthorisedToCreateCampaignException` - Only admin can create campaigns
- `InvalidCurrencyException` - Currency not associated with org
- `CurrencyBucketNotFoundException` - Currency bucket not initialized
- `AlreadyAnActiveCampaignExistsException` - Active campaign already exists

#### Key Services
- `CampaignService.createOrganizationLevelCampaign()` - Create campaign
- `CampaignService.getOrganizationLevelCampaigns()` - List campaigns
- `CampaignService.getActiveCampaignOfOrganizationAndTheirPotentialEarning()` - Get active campaigns
- `CampaignService.checkCampaignDateOverlap()` - Overlap validation
- `CampaignService.doesOrgHaveCurrencyToDistribute()` - Balance check
- `CampaignPrismaHelperService` - Database operations

#### Response Codes
- `Campaign_Created`, `Campaign_Updated`, `Campaign_Fetched`, `Campaigns_Fetched`
- `Campaign_Already_Deleted`, `Overlapping_Campaigns_Not_Allowed`
- `Not_Authorised_To_Create_Campaign`

---

### Currency Module

**File Location**: `src/modules/domain/currency/`

#### Purpose
Manages organization-specific loyalty currencies. Organizations can create custom currencies, set up currency buckets (balances), and manage exchange rates.

#### Features Implemented
- Create new currency for organization
- Search non-organization currencies
- Create currency bucket (initialize balance)
- Add balance to currency bucket
- Update currency bucket properties
- Get organization currencies
- Filter and search currencies
- Initialize currency wallets for new currencies
- Meta flag tracking (first currency added)

#### Database Models Used
- `Currency` - Currency definitions
  - `id`, `name`, `code`, `symbol`, `organizationId`
- `ExchangeRate` - Currency exchange rates
  - `currencyId`, `physicalCurrencyCode`, `rate` (Decimal)
- `CurrencyBucket` - Organization's currency balance
  - `code`, `availableAmount`, `distributedAmount`, `receivedAmount`
  - Auto top-up fields: `autoTopUpEnabled`, `autoTopUpThreshold`, `autoTopUpAmount`
- `CurrencyBucketTransaction` - Transaction history

#### API Endpoints
- `POST /currency/create` - Create new currency
- `POST /currency/create-organization-currency-bucket` - Initialize bucket
- `POST /currency/add-balance-to-bucket` - Add balance
- `POST /currency/update-currency-bucket` - Update properties
- `GET /currency/get-org-currencies` - Get organization currencies
- `GET /currency/filter-org-created-currencies` - Search currencies

#### Dependencies
- **OrganizationModule** - Organization validation
- **OrganizationOrderModule** - Order validation
- **AuthModule** - JWT verification
- **AgendaModule** - Job scheduling
- **MailAndSmsModule** - Notifications

#### Jobs/Async Work
- Currency-related job producer exists (`CurrencyJobProducer`)
- Auto top-up mechanism implementation pending

#### DTOs & Data Structures
```typescript
CreateCurrencyForm {
  name: string
  currencyCode: string (unique per org)
}

CreateOrgnizationCurrencyBucketForm {
  currencyCode: string
  initialAmount: number
}

UpdateCurrencyBucketPropertiesForm {
  currencyCode: string
  autoTopUpEnabled?: boolean
  autoTopUpThreshold?: number
  autoTopUpAmount?: number
}

AddBalanceToCurrencyBucketForm {
  currencyCode: string
  amount: number
}
```

#### Exceptions
- `NotAuthorisedToCreateCurrencyException` - Only admin can create
- `InvalidCurrencyException` - Currency doesn't exist
- `CurrencyBucketNotFoundException` - Bucket not initialized
- `CurrencyBucketNotEmptyException` - Force required to delete

#### Key Services
- `CurrencyService.createCurrency()` - Create currency with exchange rate
- `CurrencyService.searchNonOrgCurrencies()` - Search available currencies
- `CurrencyService.isCurrencyValidForThisOrganization()` - Validate currency
- `CurrencyPrismaHelperService` - Database operations

#### Response Codes
- `Created_Currency`, `Bucket_Created`, `Balance_Added`, `Properties_Updated`
- `Invalid_Currency`, `Currency_Bucket_Not_Found`, `Not_Authorised_To_Create_Currency`

---

### Customer Module

**File Location**: `src/modules/domain/customer/`

#### Purpose
Manages customer registration, authentication (OTP-based), profile management, and customer data retrieval. Customers earn and burn loyalty points through transactions.

#### Features Implemented
- Customer registration via phone (find or create)
- OTP-based authentication
- JWT token generation for customers
- Customer profile updates
- Fetch customer by ID with caching
- Get customer with wallet balances
- Fetch customer without nested data
- Image upload (logo) via ImgBB
- Cache invalidation on updates
- Logout functionality

#### Database Models Used
- `Customer` - Customer entity
  - `id`, `name`, `phoneNumber`, `countryCode`, `isVerified`
  - `metaFlags`, `logoUrl`, `fcmToken`
- `MetaFlagsForCustomer` - Customer onboarding flags
  - `initJourneyCompleted`
- `CustomerWallet` - Loyalty wallets per currency
- `CustomerOrganizationOrder` - Customer transactions

#### API Endpoints
- `POST /customer/otp/phone` - Send OTP to phone
- `POST /customer/otp/validate` - Validate OTP and get token
- `GET /customer/` - Get current customer profile (requires JWT)
- `GET /customer/:customerId` - Get customer by ID
- `POST /customer/update` - Update customer profile (requires JWT)
- `POST /customer/logout` - Logout customer

#### Dependencies
- **AuthModule** - OTP and JWT
- **MailAndSmsModule** - OTP delivery
- **OrganizationModule** - Organization data
- **CacheModule** - Customer caching
- **ImgBBModule** - Image upload

#### Caching
- **Cache Decorator**: `@Cacheable` on `getCustomerById()`
  - TTL: 5 minutes (300 seconds)
  - Key: `customer:*` pattern
- **Invalidation**: `@InvalidateCache` on updates
  - Clears all `customer:*` patterns

#### DTOs & Data Structures
```typescript
OtpPhoneFindOrCreateCustomerForm {
  phoneNumber: string
  countryCode: string
  name?: string
}

OtpValidateOtpBodyForm {
  id: string (customerId)
  otp: string
}

UpdateCustomerForm {
  name?: string
  phoneNumber?: string
  countryCode?: string
  base64Logo?: string (base64 encoded image)
}

GetCustomerParams {
  customerId: string
}
```

#### Error Handling
- `WrongCustomerOtpException` - Incorrect OTP provided
- Standard HTTP exceptions

#### Key Services
- `CustomerService.findOrCreateCustomersAndProceedPhoneAuthentication()` - Phone auth
- `CustomerService.validateOtpAndGenerateToken()` - OTP validation
- `CustomerService.getCustomerById()` - Cached retrieval
- `CustomerService.updateCustomer()` - Profile update with cache invalidation
- `CustomerPrismaHelperService` - Database operations

#### Response Codes
- `Customer_Found`, `Customer_Sent_Otp`, `Customer_Updated`, `Customer_Logged_Out`
- `Customer_Otp_Incorrect`

---

### Customer-Organization-Order Module

**File Location**: `src/modules/domain/customer-organization-order/`

#### Purpose
Handles customer transactions with organizations. When customers burn loyalty points/cash at an organization, they can earn rewards based on active campaigns. Central to the loyalty ecosystem.

#### Features Implemented
- Create customer-organization orders (burn → earn)
- Validate burning amount details (cash + coins)
- Confirm burning details against wallet balance
- Calculate earnings based on active campaigns
- Transition orders through statuses (INITIATED → COMPLETED/CANCELLED/HOLD/REFUNDED)
- Block/unblock loyalty points during transaction
- Fetch orders per customer
- Fetch orders per organization
- Get order details with potential earnings
- Update order status with history tracking
- Initialize and manage blocked points

#### Database Models Used
- `CustomerOrganizationOrder` - Main order entity
  - Status: INITIATED, COMPLETED, FAILED, CANCELLED, REFUNDED, HOLD
- `CustomerBurningAmountDetail` - Cash/coins burned
  - `BurningCashAmountDetail` - Cash amount
  - `BurningCoinAmountDetail[]` - Coin amounts (multiple currencies)
- `CustomerEarningAmountDetail` - Points earned
  - `EarningCoinAmountDetail[]` - Reward coins per currency
- `CustomerOrganizationOrderStatusHistory` - Order status transitions
- `CustomerWallet` - Wallet balances
- `CustomerWalletPocket` - Wallet pockets (per campaign/earning)

#### API Endpoints
- `POST /customer-organization/order` - Create order
- `GET /customer-organization/order/customer` - Get customer's orders
- `GET /customer-organization/order/organization` - Get org's orders
- `GET /customer-organization/order/potential-order-info/:id` - Potential earnings
- `PUT /customer-organization/order/:id` - Update order status

#### Dependencies
- **AuthModule** - JWT verification
- **OrganizationModule** - Organization and role validation
- **CampaignModule** - Active campaigns for earnings
- **CustomerModule** - Customer validation
- **CustomerWalletsModule** - Point management

#### Jobs/Async Work
- `CustomerOrganizationOrderJobProducer` - Async job scheduling
- Handles order state transitions, confirmations, notifications

#### DTOs & Data Structures
```typescript
CreateCustomerOrganizationOrderDto {
  organizationId: string
  burningAmountDetails: {
    totalAmount: number
    cash: { amount: number }
    coin?: [{
      currencyCode: string
      amount: number
    }]
  }
}

BurningCoinAmountDetailsDto {
  currencyCode: string
  amount: number
}

FetchCustomerOrdersForOrganizationQueryParams {
  page?: number
  limit?: number
  status?: CustomerOrganizationOrderStatus
  shopId?: string
  startDate?: Date
  endDate?: Date
}

CustomerBurningAmountDetailDto {
  cash?: { amount: number }
  coin?: [{ currencyCode: string, amount: number }]
  totalAmount: number
}
```

#### Exceptions
- `InsufficientPointsException` - Not enough points in wallet
- `InvalidAmountException` - Total doesn't match cash + coins
- `OrganizationDoesntHaveEnoughCurrency` - Org insufficient balance
- `OrderNotFound` - Order doesn't exist

#### State Transitions
Valid transitions defined:
```
INITIATED → [COMPLETED, CANCELLED, HOLD, REFUNDED]
COMPLETED → []
FAILED → []
CANCELLED → []
REFUNDED → []
HOLD → [COMPLETED, FAILED, CANCELLED]
```

#### Key Services
- `CustomerOrganizationOrderService.createCustomerOrganizationOrder()` - Create order
- `CustomerOrganizationOrderService.confirmBurningDetails()` - Validate points
- `CustomerOrganizationOrderService.calculateEarnings()` - Compute rewards
- `CustomerOrganizationOrderService.initializeAndBlockPoints()` - Point management
- `CustomerOrganizationOrderService.fetchOrganizationCustomerOrdersPerCustomer()` - Query

#### Response Codes
- `Order_Created`, `Order_Updated`, `Orders_Fetched`
- `Insufficient_Points`, `Invalid_Amount`, `Not_Enough_Currency`

---

### Customer-Wallets Module

**File Location**: `src/modules/domain/customer-wallets/`

#### Purpose
Manages loyalty point wallets for customers per currency. Implements pocket-based system for balance tracking with states: available, blocked, pending, used, expired.

#### Features Implemented
- Initialize customer wallet per currency
- Block points (for pending orders)
- Unblock points (cancel pending blocks)
- Debit blocked points (mark as used)
- Add pending points (queue for credit)
- Credit pending points (finalize credit)
- Cancel pending points
- Get wallet balance by currency
- Get wallet transaction history
- Pocket-level balance management

#### Database Models Used
- `CustomerWallet` - Main wallet per customer-currency
  - `availableBalance`, `blockedBalance`, `pendingBalance`, `usedBalance`, `expiredBalance`
- `CustomerWalletPocket` - Grouped points (by campaign/source)
  - Same balance fields as wallet
  - `expiryDate` - Auto-expire points
- `CustomerWalletPocketTransaction` - Transaction log
  - `status`: PENDING, COMPLETED, CANCELLED, BLOCKED, UNBLOCKED, DEBITED
  - `transactionRef`, `amount`

#### API Endpoints
- `GET /customer-wallets/:currencyCode` - Get wallet balance
- `POST /customer-wallets/block-points` - Block points
- `POST /customer-wallets/unblock-points` - Unblock points
- `POST /customer-wallets/add-pending-points` - Queue points
- `POST /customer-wallets/credit-pending-points` - Finalize credit
- `GET /customer-wallets/transactions` - Transaction history

#### Dependencies
- **AuthModule** - JWT verification
- **AgendaModule** - Scheduled point expiry

#### Jobs/Async Work
- **Point Expiry Jobs**: Scheduled via Agenda
- `CustomerWalletJobProducer` - Schedules expiry and auto-debit
- `CustomerWalletJobConsumer` - Processes expiry events

#### DTOs & Data Structures
```typescript
CustomerBlockPoints {
  currencyCode: string
  customerId: string
  amount: number
  transactionRef: string
  unblockInMinutes?: number (-1 for never auto-unblock)
}

CustomerDebitAfterBlockPoints {
  currencyCode: string
  customerId: string
  transactionRef: string
}

CustomerUnblockPoints {
  currencyCode: string
  customerId: string
  transactionRef: string
}

CustomerAddPendingPoints {
  currencyCode: string
  customerId: string
  amount: number
  transactionRef: string
}
```

#### Exceptions
- `InsufficientCurrencyBalanceException` - Not enough available balance
- `TransactionNotFoundException` - Transaction ref not found
- `CustomerWalletNotFoundException` - Wallet not initialized

#### Balance Rules
- Sum of all pocket `availableBalance` = Main wallet `availableBalance`
- Points auto-expire based on `expiryDate` in pocket
- Blocked points cannot be used until unblocked
- Pending points await confirmation before becoming available

#### Key Services
- `CustomerWalletService.initialize()` - Create wallet for customer-currency
- `CustomerWalletService.blockPoints()` - Freeze points for pending order
- `CustomerWalletService.debitAfterBlockPoints()` - Mark blocked as used
- `CustomerWalletService.unblockPoints()` - Cancel blocking
- `CustomerWalletService.addPendingPoints()` - Queue new points
- `CustomerWalletService.creditPendingPoints()` - Finalize points
- `CustomerWalletService.cancelPendingPoints()` - Cancel queued points

#### Response Codes
- `Points_Blocked`, `Points_Credited`, `Points_Unblocked`
- `Points_Not_Enough`, `No_Blocked_Transactions_Found`

---

### Mail-and-SMS Module

**File Location**: `src/modules/domain/mail-and-sms/`

#### Purpose
Notification service for sending emails and SMS to organizations and customers. Handles OTP delivery and transactional messages via Factor2 SMS gateway.

#### Features Implemented
- Send OTP via email
- Send OTP via SMS (Factor2 integration)
- Send contact/inquiry emails
- Get in touch email handler
- Template-based SMS sending
- Environment-specific OTP handling (hardcoded for dev/test)

#### External Integrations
- **Nodemailer**: Email sending
  - Configured via environment variables
  - `SENDER_MAIL` - From address
- **Factor2**: SMS delivery
  - Custom OTP sending: `sendCustomGeneratedOtp()`
  - Transaction SMS: `sendTransactionSms()` with template variables
  - Template variable substitution support

#### API Endpoints
- `POST /mail-sms/send-contact-us` - Send inquiry email
- (OTP endpoints handled via Auth module)

#### Dependencies
- **Factor2HttpModule** - HTTP client for Factor2
- **Factor2Module** - Factor2 service
- **AgendaModule** - Job scheduling for notifications
- **Nodemailer** - Email service

#### DTOs & Data Structures
```typescript
GetInTouch {
  metaData: {
    name: string
    email: string
    message: string
  }
}

Factor2SendCustomGeneratedOtpRequest {
  phoneNumberWithCountryCodeAndPlus: string (e.g., +919999999999)
  otp: string
  templateName: string
}

Factor2SendTransactionSmsRequestWithVars {
  templateName: string
  phoneNumber: string
  from: string
  vars: string[]
}
```

#### Key Services
- `MailAndSmsService.sendOtpToMail()` - Email OTP
- `MailAndSmsService.sendOtpToPhone()` - SMS OTP via Factor2
- `MailAndSmsService.getInTouch()` - Contact email
- `Factor2Service.sendCustomGeneratedOtp()` - SMS with OTP
- `Factor2Service.sendTransactionSms()` - Template SMS

#### Environment Configuration
- `SENDER_MAIL` - Email from address
- `FACTOR2_API_KEY` - Factor2 authentication
- `ENVIRONMENT` - Determines if OTP is hardcoded (dev/test: "123456")
- `COMMA_SEPARATED_TESTING_PHONE_NUMBERS` - Phones receiving test OTP

---

### Organization Module

**File Location**: `src/modules/domain/organization/`

#### Purpose
Core entity managing organizations (brands/retailers) in the loyalty system. Organizations can be ADMIN (creates ecosystem) or SHOP (subordinate to admin). Handles org authentication, role management, and currency initialization.

#### Features Implemented
- Find or create organization by phone number
- OTP-based organization authentication
- JWT token generation for organizations
- Organization profile management
- Invite shops to organization
- Get organization with campaigns and metadata
- Get organization with currencies and buckets
- Organization verification and KYC tracking
- Meta flag tracking (first campaign, first currency)
- Currency initialization for organizations
- Organization updates with image handling
- Fetch parent organization for shops

#### Database Models Used
- `Organization` - Organization entity
  - `role`: ADMIN or SHOP
  - `orgAdminId`: Parent admin for shops
  - `isVerified`, `kycStatus`
  - Relations: `currencies`, `currencyBuckets`, `campaigns`, `orders`
- `MetaFlagsForOrganization` - Onboarding state
  - `initJourneyCompleted`, `firstCampaignCreated`, `firstCurrencyAdded`
- `Invite` - Role-based invitations
  - `assignedTo` (phone), `role`, `orgAdminId`, `location`, `isUsed`

#### API Endpoints
- `POST /organization/otp/phone` - Send OTP to phone
- `POST /organization/otp/validate` - Validate OTP and get token
- `GET /organization/` - Get org profile (requires JWT)
- `POST /organization/update` - Update org profile
- `POST /organization/invite-shop` - Invite shop
- `GET /organization/shops` - Get shops for organization
- `POST /organization/send-interest` - Express interest

#### Dependencies
- **AuthModule** - OTP and JWT
- **MailAndSmsModule** - OTP delivery
- **OrganizationOrderModule** - Order management
- **AgendaModule** - Job scheduling
- **ImgBBModule** - Logo/cover uploads
- **CacheModule** - Redis caching

#### Jobs/Async Work
- `OrganizationJobConsumer` - Processes organization events

#### DTOs & Data Structures
```typescript
LoginOrganizationOtpForm {
  phoneNumber: string
  countryCode: string
}

ValidateOrganizationOtpForm {
  id: string (organizationId)
  otp: string
}

InviteShopForm {
  phoneNumber: string
  location: string
}

UpdateOrganizationForm {
  name?: string
  address?: string
  logoUrl?: string
  coverUrl?: string
  upiURI?: string
  operationalHours?: string
  aboutUs?: string
  contactUs?: string
  base64Logo?: string
  base64Cover?: string
}

SendInterestForm {
  email: string
  message: string
}
```

#### Exceptions
- `WrongOrganizationOtpException` - Incorrect OTP
- `InvalidAdminOrganizationException` - Invalid admin role
- `CurrencyDoesNotExistsForThisOrganizationException` - Currency not found
- `CurrencyBucketAlreadyInitialiedForThisOrganizationException` - Already initialized

#### Key Services
- `OrganizationService.findOrCreateOrganizationAndProceedPhoneAuthentication()` - Phone auth
- `OrganizationService.validateOtpAndGenerateToken()` - OTP validation
- `OrganizationService.getOrganization()` - Get org details
- `OrganizationService.getOrganizationWithCurrenciesAndCurrencyBuckets()` - Get with currencies
- `OrganizationService.updateOrganization()` - Update profile
- `OrganizationService.initNewCurrency()` - Initialize currency wallet
- `OrganizationPrismaHelperService` - Database operations

#### Response Codes
- `Organization_Found`, `Organization_Sent_Otp`, `Organization_Updated`
- `Organization_Otp_Incorrect`, `Invalid_Organization`

---

### Organization-Order Module

**File Location**: `src/modules/domain/organization-order/`

#### Purpose
Manages currency purchase orders by organizations. Organizations buy currency balance through orders, tracked with status history.

#### Features Implemented
- Create organization orders (CURRENCY_PURCHASE type)
- Fetch organization orders with pagination
- Get order by ID
- Update order status with history tracking
- Order status transitions tracking
- Search/filter orders

#### Database Models Used
- `OrganizationOrder` - Order entity
  - `orderType`: CURRENCY_PURCHASE
  - `orderStatus`: PENDING, SUCCESS, FAILED, CANCELLED
- `OrganizationOrderStatusHistory` - Status change log
- `OrderDetails` - Order specifics (currencyCode)

#### API Endpoints
- `POST /organization/order` - Create order
- `GET /organization/order` - Fetch orders (paginated)
- `GET /organization/order/:id` - Get order details
- `PUT /organization/order/:id` - Update order status

#### Dependencies
- **AuthModule** - JWT verification
- Uses Prisma transactions for consistency

#### DTOs & Data Structures
```typescript
CreateOrderDto {
  orderType: OrganizationOrderType (CURRENCY_PURCHASE)
  amount?: number
  details: { currencyCode: string }
}

UpdateOrderDto {
  newStatus: OrganizationOrderStatus
}

OrderDetails {
  currencyCode: string
}
```

#### Key Services
- `OrganizationOrderService.createOrganizationOrder()` - Create order
- `OrganizationOrderService.fetchOrganizationOrders()` - List with pagination
- `OrganizationOrderService.getOrganizationOrder()` - Get single
- `OrganizationOrderService.updateOrganizationOrder()` - Update status

---

### Shop Module

**File Location**: `src/modules/domain/shop/`

#### Purpose
Manages shop-level operations for organizations with SHOP role. Shops are subordinate entities to admin organizations.

#### Features Implemented
- Fetch active shops for organization
- Update shop profile (admin-only)
- Shop authorization validation (orgAdminId check)

#### Database Models Used
- `Organization` (with role=SHOP)
  - Filtered by `orgAdminId` and `role: SHOP`

#### API Endpoints
- `GET /shop/active` - Get active shops for organization
- `POST /shop/update` - Update shop profile (admin-only)

#### Dependencies
- **OrganizationModule** - Organization validation

#### DTOs & Data Structures
```typescript
UpdateShopForm {
  shopId: string
  name?: string
  phoneNumber?: string
  address?: string
  upiURI?: string
  aboutUs?: string
  contactUs?: string
  operationalHours?: string
}
```

#### Key Services
- `ShopService.fetchActiveShopsOfAnOrg()` - List shops
- `ShopService.updateShop()` - Update profile (with authorization)

---

## Core Modules

### Factor2 Module

**File Location**: `src/modules/core/factor2/`

#### Purpose
Integration with Factor2 SMS gateway for transactional SMS delivery.

#### Features
- Send custom OTP via SMS
- Send template-based transaction SMS
- Variable substitution in SMS templates

#### Services
- `Factor2Service.sendCustomGeneratedOtp()` - OTP delivery
- `Factor2Service.sendTransactionSms()` - Template SMS with variables

#### Configuration
- `FACTOR2_API_KEY` - Authentication key
- Endpoints: Factor2 API v1 and R1

---

### ImgBB Module

**File Location**: `src/modules/core/imgbb/`

#### Purpose
Image hosting service for uploading organization logos, covers, and customer images.

#### Features
- Upload images to ImgBB
- Return thumbnail URL for logos
- Return medium URL for covers

#### Services
- `ImgBBService.uploadImage()` - Upload and return URL

#### Configuration
- `IMGBB_API_KEY` - Authentication key

---

### PhonePe Module

**File Location**: `src/modules/core/phonepe/`

#### Purpose
Integration with PhonePe payment gateway (implementation pending).

#### Current State
- Module structure defined
- Service skeleton exists
- Full implementation not yet completed

---

## Infrastructure Modules

### Health Check Module

**File Location**: `src/modules/health/`

#### Purpose
Provides health check endpoints for Kubernetes/Docker orchestration and monitoring.

#### Features Implemented
- PostgreSQL connection health check
- Redis connection health check
- Liveness probe (simple server check)
- Readiness probe (dependencies check)

#### API Endpoints
- `GET /health` - Full health check (PostgreSQL + Redis)
- `GET /health/readiness` - Readiness probe (PostgreSQL + Redis)
- `GET /health/liveness` - Liveness probe (server running)

#### Dependencies
- **@nestjs/terminus** - Health check framework
- `PrismaHealthIndicator` - PostgreSQL health
- `RedisHealthIndicator` - Redis health

---

## Database Schema Overview

### Entity Relationships

```
Organization (ADMIN or SHOP)
├── MetaFlagsForOrganization
├── Currency
│   └── ExchangeRate
├── CurrencyBucket
│   └── CurrencyBucketTransaction
├── OrganizationCampaign
│   └── EarningCoinAmountDetail
└── OrganizationOrder
    └── OrderDetails

Customer
├── MetaFlagsForCustomer
└── CustomerWallet
    └── CustomerWalletPocket
        └── CustomerWalletPocketTransaction

CustomerOrganizationOrder
├── CustomerBurningAmountDetail
│   ├── BurningCashAmountDetail
│   └── BurningCoinAmountDetail
├── CustomerEarningAmountDetail
│   └── EarningCoinAmountDetail
└── CustomerOrganizationOrderStatusHistory
```

### Key Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `organization` | Brand/retailer entity | id, name, phoneNumber, role, orgAdminId |
| `customer` | Loyalty program participant | id, phoneNumber, isVerified |
| `currency` | Organization loyalty currency | code, name, organizationId |
| `currencyBucket` | Org's currency balance | code, availableAmount, organizationId |
| `organizationCampaign` | Earning rules | name, earningPercentage, startDate, endDate |
| `customerWallet` | Points per customer-currency | availableBalance, blockedBalance, pendingBalance |
| `customerWalletPocket` | Grouped points (by source) | availableBalance, blockedBalance, expiryDate |
| `customerOrganizationOrder` | Transaction (burn→earn) | customerId, organizationId, status |

---

## Cross-Module Dependencies

```
Customer-Organization-Order
├── requires: Campaign (for earnings calculation)
├── requires: Organization (for role validation)
├── requires: Customer (for wallet management)
└── requires: CustomerWallets (for point operations)

Campaign
├── requires: Organization (currency validation)
├── requires: Currency (currency existence check)
└── requires: Customer (implicit via orders)

Currency
├── requires: Organization (currency bucket init)
└── requires: OrganizationOrder (order validation)

Organization
├── requires: Auth (OTP/JWT)
└── requires: MailAndSms (notifications)

Customer
├── requires: Auth (OTP/JWT)
└── requires: MailAndSms (notifications)
```

---

## Caching Strategy

### Cache Implementations
1. **Customer Profiles** (CustomerService)
   - TTL: 5 minutes
   - Key pattern: `customer:*`
   - Decorator: `@Cacheable`

2. **Organization Data** (OrganizationService)
   - Manual cache via CacheService
   - Used for frequently accessed org data

3. **Campaign Data** (CampaignService)
   - Cache for active campaigns
   - Invalidated on campaign updates

### Cache Backends
- **Redis** - Primary cache storage
- **RedisCacheStrategy** - Custom implementation

---

## Job Scheduling (Agenda)

### Job Types

| Job Name | Producer | Trigger | Purpose |
|----------|----------|---------|---------|
| `CAMPAIGN_EXPIRY_REMINDER` | CampaignJobProducer | Campaign creation | Notify orgs of expiring campaigns |
| `CURRENCY_AUTO_TOPUP` | CurrencyJobProducer | Low balance | Auto-refill currency buckets |
| `WALLET_POINT_EXPIRY` | CustomerWalletJobProducer | Pending expiry | Expire old points |
| `ORDER_CONFIRMATION` | CustomerOrganizationOrderJobProducer | Order creation | Process order state transitions |

### Scheduling Pattern
- Uses Agenda for persistence
- Unique job IDs prevent duplicates
- Configurable TTL and retry logic

---

## Authentication & Authorization

### Authentication Flow
1. **Phone OTP Flow** (for both Org and Customer)
   - POST `/organization/otp/phone` or `/customer/otp/phone`
   - OTP sent via SMS (Factor2) or hardcoded in dev
   - POST `/organization/otp/validate` or `/customer/otp/validate`
   - JWT returned with 14-day expiry

2. **Session Validation**
   - JWT verified against cached session ID
   - One device per user (session invalidates on new login)
   - TTL: 14 days matching JWT expiry

3. **Role-Based Access**
   - `OrganizationRoles.ADMIN` - Full access
   - `OrganizationRoles.SHOP` - Limited to own shop
   - Validated via JWT `userType` claim

### Protected Endpoints
- Marked with `@UseInterceptors(VerifyJWTAndFetchPayload)`
- JWT payload injected into request object
- `UserTypes` enum: `organization` or `customer`

---

## Error Handling Strategy

### Exception Hierarchy
- **Custom Exceptions** extend NestJS base exceptions
- Each includes error code and readable message
- Response format: `{ error: string, errorCode: ResponseCode }`

### Error Codes
- Organized per module in `enums/responseCodes.ts`
- Used for frontend error handling/localization
- Examples:
  - `Campaign_Created`, `Campaign_Already_Active`
  - `Order_Created`, `Insufficient_Points`
  - `Customer_Found`, `Customer_Otp_Incorrect`

---

## Configuration

### Environment Variables
```
# Database
LSB_PG_URL=postgresql://user:password@host:5432/db

# Redis (REDIS_URL takes precedence over the discrete fields)
REDIS_URL=rediss://default:password@host:6379
# REDIS_HOST=localhost
# REDIS_PORT=6379

# Authentication
JWT_SECRET=your-secret-key

# OTP
OTP_TIME_OUT_MINUTES=10
COMMA_SEPARATED_TESTING_PHONE_NUMBERS=9999999999,8888888888

# Factor2 SMS
FACTOR2_API_KEY=key

# ImgBB Image Upload
IMGBB_API_KEY=key

# Email
SENDER_MAIL=noreply@loyalty.com

# Campaign Configuration
CAMPAIGN_REMINDER_DAYS=5
MINIMUM_CAMPAIGN_AMOUNT_IN_INR=1000

# Environment
ENVIRONMENT=dev|stage|prod
```

---

## API Response Format

### Success Response
```json
{
  "status": "success",
  "code": "Campaign_Created",
  "data": { /* entity data */ },
  "metadata": { /* pagination metadata if applicable */ }
}
```

### Error Response
```json
{
  "error": "Descriptive error message",
  "errorCode": "Error_Code_Enum"
}
```

### Pagination Metadata
```json
{
  "page": 1,
  "limit": 10,
  "totalItems": 50,
  "totalPages": 5,
  "hasNextPage": true,
  "hasPreviousPage": false
}
```

---

## Testing & Development

### Local Environment
- Hardcoded OTP: "123456"
- Testing phone numbers configured via env
- ImgBB integration for image upload
- Factor2 SMS gateway (test/live modes)

### Database Migrations
- Location: `prisma/migrations/0_init_full/` (squashed full-schema baseline)
- Legacy incremental migrations archived in `prisma/migrations_legacy/` (reference only)
- Prisma CLI for schema updates (`prisma migrate dev` / `prisma migrate deploy`)
- PostgreSQL with UUID generation

---

## Summary of Features

### Core Capabilities
✅ Multi-tenant organization support (Admin + Shops)  
✅ OTP-based authentication for orgs and customers  
✅ Custom loyalty currency per organization  
✅ Campaign-based earning rules  
✅ Pocket-based point wallet system  
✅ Cash + coin transaction support  
✅ Status-tracked order workflow  
✅ SMS/Email notifications  
✅ Image upload (logos/covers)  
✅ Health checks (PostgreSQL + Redis)  
✅ Caching with Redis  
✅ Async job scheduling with Agenda  

### Pending/In-Progress
⏳ PhonePe payment gateway integration  
⏳ Admin dashboard UI  
⏳ Analytics and reporting  
⏳ Advanced campaign rules  
⏳ Point expiry automation (jobs defined)  

---

## Deployment Considerations

### Container Requirements
- Node.js runtime
- PostgreSQL 12+ client
- Redis connectivity
- External service credentials:
  - Factor2 API key
  - ImgBB API key
  - PhonePe merchant details

### Kubernetes Resources
- Health checks configured for liveness/readiness probes
- Graceful shutdown handling needed
- Job persistence via pg-boss in PostgreSQL (`pgboss` schema)

### Scaling Considerations
- Stateless API design (sessions in Redis)
- Async jobs distributed via pg-boss
- Database connection pooling via Prisma
- Cache layer for frequently accessed data

