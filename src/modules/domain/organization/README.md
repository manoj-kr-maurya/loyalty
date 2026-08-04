# Organization Module

> **Last Updated**: July 2026  
> **Status**: All 11 endpoints tested and working ✅  
> **Postman Collection**: `postman/organization-apis.postman_collection.json`

## Overview

The Organization Module manages the core business entities in the JAS Loyalty Engine. Organizations (retailers, brands, merchants) create and manage their own loyalty programs, invite team members, manage currencies, campaigns, and customer interactions.

---

## 📋 API Endpoints (All Tested ✅)

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 1 | `POST` | `/organization/otp/phone` | ❌ Public | Send OTP to phone number |
| 2 | `POST` | `/organization/otp/validate` | ❌ Public | Validate OTP & get JWT |
| 3 | `GET` | `/organization/get-your-admin` | ✅ JWT | Get admin org by orgAdminId |
| 4 | `GET` | `/organization/` | ✅ JWT | Get authenticated org details |
| 5 | `POST` | `/organization/logout` | ✅ JWT | Logout (invalidate session) |
| 6 | `POST` | `/organization/update` | ✅ JWT | Update organization profile |
| 7 | `POST` | `/organization/send-interest` | ❌ Public | Register interest |
| 8 | `POST` | `/organization/invite-shop` | ✅ JWT | Invite a shop manager |
| 9 | `GET` | `/organization/invited-shops` | ✅ JWT | List invited shops |
| 10 | `GET` | `/organization/leader-board/top-organizations` | ✅ JWT | Paginated leaderboard |
| 11 | `GET` | `/organization/leader-board/organization/detail/:orgAdminId` | ✅ JWT | Leaderboard org detail |

---

## 1. Send OTP — `POST /organization/otp/phone`

**Auth**: None (public)  
**Description**: Initiates the OTP login flow. Finds or creates an organization by phone number. Requires an invite to exist in the database for the phone number.

### Request
```json
{
  "countryCode": "91",
  "phoneNumber": "9999999999"
}
```

### Success Response (201)
```json
{
  "status": "Success",
  "code": "Organization_Sent_Otp",
  "data": "7b8c0db5-e7d9-46be-b004-57a942ed6c65"
}
```
> `data` contains the organization ID. Use this in the validate OTP call.

### Error Responses
| Status | Code | Description |
|--------|------|-------------|
| 422 | `Invite_Code_Not_Found` | No invite exists for this phone number |

### cURL
```bash
curl -X POST http://localhost:3003/organization/otp/phone \
  -H "Content-Type: application/json" \
  -d '{"countryCode":"91","phoneNumber":"9999999999"}'
```

---

## 2. Validate OTP — `POST /organization/otp/validate`

**Auth**: Public  
**Description**: Validates the OTP and returns a JWT token. In dev mode, the OTP is always `123456`. The OTP expires after 10 minutes.

### Request
```json
{
  "otp": "123456",
  "id": "7b8c0db5-e7d9-46be-b004-57a942ed6c65"
}
```
> `id` is the organization ID from the Send OTP response.

### Success Response (201)
```json
{
  "status": "Success",
  "code": "Organization_Verified",
  "data": {
    "organization": {
      "id": "7b8c0db5-e7d9-46be-b004-57a942ed6c65",
      "name": "Test Org",
      "phoneNumber": "9999999999",
      "countryCode": "91",
      "isVerified": true,
      "kycStatus": false,
      "token": "eyJhbGciOiJIUzI1NiIs...",
      "role": "ADMIN",
      "orgAdminId": "7b8c0db5-e7d9-46be-b004-57a942ed6c65",
      "address": "123 Test St",
      "logoUrl": null,
      "coverUrl": null,
      "upiURI": null,
      "operationalHours": "9-5",
      "aboutUs": "We are a test org",
      "contactUs": "test@org.com"
    },
    "metaFlags": {
      "id": "17845bb7-...",
      "initJourneyCompleted": false,
      "firstCampaignCreated": false,
      "firstCurrencyAdded": false,
      "firstCurrencyBalanceAdded": false,
      "organizationId": "7b8c0db5-e7d9-46be-b004-57a942ed6c65"
    }
  }
}
```

### Error Responses
| Code | Description |
|------|-------------|
| `Organization_Otp_Incorrect` | Wrong OTP entered |
| `Organization_Otp_Expired` | OTP expired (10 min TTL) |

### cURL
```bash
curl -X POST http://localhost:3003/organization/otp/validate \
  -H "Content-Type: application/json" \
  -d '{"otp":"123456","id":"7b8c0db5-e7d9-46be-b004-57a942ed6c65"}'
```

---

## 3. Get Your Admin — `GET /organization/get-your-admin`

**Auth**: JWT required  
**Description**: Fetches the admin organization by `orgAdminId` query parameter.

### Request
```
GET /organization/get-your-admin?orgAdminId=7b8c0db5-e7d9-46be-b004-57a942ed6c65
Authorization: Bearer <jwt_token>
```

### Success Response (200)
```json
{
  "status": "Success",
  "code": "Fetched_Your_Admin",
  "data": {
    "id": "7b8c0db5-e7d9-46be-b004-57a942ed6c65",
    "name": "Test Org",
    "phoneNumber": "9999999999",
    "countryCode": "91",
    "isVerified": true,
    "role": "ADMIN",
    "orgAdminId": "7b8c0db5-e7d9-46be-b004-57a942ed6c65"
  }
}
```

### cURL
```bash
curl -X GET "http://localhost:3003/organization/get-your-admin?orgAdminId=7b8c0db5-e7d9-46be-b004-57a942ed6c65" \
  -H "Authorization: Bearer <jwt_token>"
```

---

## 4. Get Organization Details — `GET /organization/`

**Type**: JWT required  
**Description**: Returns the authenticated organization's full profile including metaFlags.

### Request
```
GET /organization/
Authorization: Bearer <jwt_token>
```

### Success Response (200)
```json
{
  "status": "Success",
  "code": "Organization_Fetched",
  "data": {
    "organization": {
      "id": "7b8c0db5-e7d9-46be-b004-57a942ed6c65",
      "name": "Test Org",
      "phoneNumber": "9999999999",
      "countryCode": "91",
      "isVerified": true,
      "address": "123 Test St",
      "logoUrl": null,
      "coverUrl": null,
      "upiURI": null,
      "operationalHours": "9-5",
      "aboutUs": "We are a test org",
      "contactUs": "test@org.com"
    },
    "metaFlags": {
      "initJourneyCompleted": false,
      "firstCampaignCreated": false,
      "firstCurrencyAdded": false,
      "firstCurrencyBalanceAdded": false
    }
  }
}
```

### cURL
```bash
curl -X GET http://localhost:3003/organization/ \
  -H "Authorization: Bearer <jwt_token>"
```

---

## 5. Logout — `POST /organization/logout`

**Auth**: JWT required  
**Description**: Invalidates the current JWT session in Redis. The token becomes unusable after this call.

### Request
```
POST /organization/logout
Authorization: Bearer <jwt_token>
```

### Success Response (201)
```json
{
  "success": true,
  "message": "Token removed successfully"
}
```

### cURL
```bash
curl -X POST http://localhost:3003/organization/logout \
  -H "Authorization: Bearer <jwt_token>"
```

---

## 6. Update Organization — `POST /organization/update`

**Auth**: JWT required  
**Description**: Updates the organization profile. All fields are optional — only send what you want to change.

### Request Body
```json
{
  "name": "Updated Org Name",
  "address": "456 New Street, Mumbai",
  "base64Logo": null,
  "base64Cover": null,
  "upiURI": "upi://pay?pa=test@upi",
  "contactUs": "support@myorg.com",
  "operationalHours": "9:00 AM - 9:00 PM",
  "aboutUs": "Leading loyalty platform provider"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Organization display name |
| `address` | string | Physical address |
| `base64Logo` | string? | Base64-encoded logo image (uploaded to ImgBB) |
| `base64Cover` | string? | Base64-encoded cover image |
| `upiURI` | string? | UPI payment URI |
| `contactUs` | string? | Contact information |
| `operationalHours` | string? | Business hours |
| `aboutUs` | string? | About section |

### Success Response (201)
```json
{
  "status": "Success",
  "code": "Organization_Updated",
  "data": {
    "id": "7b8c0db5-e7d9-46be-b004-57a942ed6c65",
    "name": "Updated Org Name",
    "address": "456 New Street, Mumbai",
    "contactUs": "support@myorg.com",
    "operationalHours": "9:00 AM - 9:00 PM",
    "aboutUs": "We are a leading loyalty platform"
  }
}
```

### cURL
```bash
curl -X POST http://localhost:3003/organization/update \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Org","address":"456 New St","aboutUs":"Leading loyalty platform"}'
```

---

## 7. Send Interest — `POST /organization/send-interest`

**Auth**: Public (no auth)  
**Description**: Registers interest from a potential organization. The phone number must be unique.

### Request
```json
{
  "phoneNumber": "8888888888"
}
```

### Success Response (201)
```json
{
  "status": "Success",
  "code": "Send_Interest"
}
```

### Error Responses
| Code | Description |
|------|-------------|
| `Interest_Already_Exists` | Phone number already registered interest |

### cURL
```bash
curl -X POST http://localhost:3003/organization/send-interest \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"8888888888"}'
```

---

## 8. Invite Shop — `POST /organization/invite-shop`

**Auth**: JWT required  
**Description**: Invites a shop manager by phone number. Creates an invite record with role `SHOP`.

### Request
```json
{
  "phoneNumber": "7777777777",
  "location": "Mumbai Central"
}
```

### Success Response (201)
```json
{
  "status": "Success",
  "code": "Invited_Shop",
  "data": {
    "id": "e548ed39-dd66-40f3-99e9-e1ed20fed3ca",
    "isUsed": false,
    "assignedTo": "7777777777",
    "location": "Mumbai Central",
    "role": "SHOP",
    "orgAdminId": "7b8c0db5-e7d9-46be-b004-57a942ed6c65"
  }
}
```

### cURL
```bash
curl -X POST http://localhost:3003/organization/invite-shop \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"7777777777","location":"Mumbai Central"}'
```

---

## 9. Get Invited Shops — `GET /organization/invited-shops`

**Auth**: JWT required  
**Description**: Lists all shop invites sent by the authenticated organization.

### Request
```
GET /organization/invited-shops
Authorization: Bearer <jwt_token>
```

### Success Response (200)
```json
{
  "status": "Success",
  "code": "Fetched_Shop_Invites",
  "data": [
    {
      "id": "e548edf-dd66-40f3-99e9-e1ed20fed3ca",
      "isUsed": false,
      "assignedTo": "7777777777",
      "location": "Mumbai Central",
      "role": "SHOP",
      "orgAdminId": "7b8c0db5-e7d9-46be-b004-57a942ed6c65",
      "createdAt": "2026-07-29T17:52:18.196Z"
    }
  ]
}
```

### cURL
```bash
curl -X GET http://localhost:3003/organization/invited-shops \
  -H "Authorization: Bearer <jwt_token>"
```

---

## 10. Leaderboard — Top Organizations — `GET /organization/leader-board/top-organizations`

**Auth**: JWT required  
**Description**: Returns a paginated list of top organizations for the leaderboard. Supports `page` and `limit` query parameters.

### Request
```
GET /organization/leader-board/top-organizations?page=1&limit=10
Authorization: Bearer <jwt_token>
```

### Success Response (200)
```json
{
  "status": "Success",
  "code": "Leader_Board_Organizations_Fetched",
  "data": {
    "organizations": [
      {
        "id": "7b8c0db5-e7d9-46be-b004-57a942ed6c65",
        "name": "Test Org",
        "logoUrl": null,
        "coverUrl": null,
        "aboutUs": "We are a test org",
        "totalCashbackData": {
          "totalSpent": 0,
          "totalAvailable": 0,
          "totalEarned": 0
        }
      }
    ],
    "metadata": {
      "currentPage": 1,
      "totalPages": 1,
      "totalItems": 1,
      "itemsPerPage": 10,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

### cURL
```bash
curl -X GET "http://localhost:3003/organization/leader-board/top-organizations?page=1&limit=10" \
  -H "Authorization: Bearer <jwt_token>"
```

---

## 11. Leaderboard — Organization Detail — `GET /organization/leader-board/organization/detail/:orgAdminId`

**Auth**: JWT required  
**Description**: Fetches detailed leaderboard info for a specific organization including total cashback data and shop list.

### Request
```
GET /organization/leader-board/organization/detail/7b8c0db5-e7d9-46be-b004-57a942ed6c65
Authorization: Bearer <jwt_token>
```

### Success Response (200)
```json
{
  "status": "Success",
  "code": "Leader_Board_Organization_Detail_Fetched",
  "data": {
    "logoUrl": null,
    "coverUrl": null,
    "aboutUs": "We are a test org",
    "totalCashbackData": {
      "totalSpent": 0,
      "totalAvailable": 0,
      "totalEarned": 0
    },
    "shops": [
      {
        "id": "7b8c0db5-e7d9-46be-b004-57a942ed6c65",
        "name": "Test Org",
        "phoneNumber": "9999999999",
        "address": "123 Test St"
      }
    ]
  }
}
```

### cURL
```bash
curl -X GET http://localhost:3003/organization/leader-board/organization/detail/7b8c0db5-e7d9-46be-b004-57a942ed6c65 \
  -H "Authorization: Bearer <jwt_token>"
```

---

## Authentication Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. Send OTP  │────▶│ 2. Validate  │────▶│ 3. Use JWT   │
│  POST /otp/   │     │  POST /otp/  │     │  Bearer token│
│  phone        │     │  validate    │     │  in all APIs │
└──────────────┘     └──────────────┘     └──────────────┘
       │                     │
       ▼                     ▼
  Returns org ID       Returns JWT token
  (use in step 2)      (14-day expiry)
```

### OTP Details
- **Dev Mode**: OTP is hardcoded as `123456`
- **Storage**: Redis with 10-minute TTL
- **Key Format**: Organization ID (e.g., `7b8c0db5-e7d9-46be-b004-57a942ed6c65`)
- **Check Redis**: `docker exec lsbbe_redis redis-cli GET "<orgId>"`

### JWT Details
- **Algorithm**: HS256
- **Expiry**: 14 days
- **Payload**: `sub` (org ID), `sessionId`, `userType` ("Object")
- **Storage**: Redis session key `{userId}-session`

### Prerequisites for OTP Flow
An invite record must exist in the database for the phone number:
```sql
INSERT INTO invite (id, "isUsed", "assignedTo", location, "generatedBy", role, "orgAdminId", "createdAt", "updatedAt")
VALUES ('test-invite-001', false, '9999999999', 'Test Location', 'system', 'ADMIN', NULL, NOW(), NOW());
```

---

## Database Models

### Organization
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | Organization name |
| `phoneNumber` | String (unique) | Phone number |
| `countryCode` | String | e.g., "91" |
| `isVerified` | Boolean | OTP verified |
| `kycStatus` | Boolean | KYC completed |
| `isSoftDeleted` | Boolean | Soft delete flag |
| `address` | String? | Physical address |
| `logoUrl` | String? | ImgBB logo URL |
| `coverUrl` | String? | ImgBB cover URL |
| `upiURI` | String? | UPI payment URI |
| `operationalHours` | String? | Business hours |
| `aboutUs` | String? | About section |
| `contactUs` | String? | Contact info |
| `role` | OrganizationRoles | ADMIN, SHOP, USER |
| `orgAdminId` | String? | Self-referencing admin ID |
| `fcmToken` | String? | Firebase Cloud Messaging token |

### Invite
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `assignedTo` | String (unique) | Phone number |
| `role` | OrganizationRoles | ADMIN, SHOP |
| `location` | String? | Shop location |
| `isUsed` | Boolean | Whether accepted |
| `orgAdminId` | String? | FK to Organization |
| `generatedBy` | String | Who created the invite |

### Interest
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `phoneNumber` | String (unique) | Phone number |
| `createdAt` | DateTime | Timestamp |

### MetaFlagsForOrganization
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `organizationId` | String | FK to Organization |
| `initJourneyCompleted` | Boolean | Onboarding done |
| `firstCampaignCreated` | Boolean | First campaign |
| `firstCurrencyAdded` | Boolean | First currency |
| `firstCurrencyBalanceAdded` | Boolean | First balance |

---

## Dependencies

| Service | Purpose |
|---------|---------|
| `AuthService` | JWT generation and session management |
| `CommonDBService` | Shared DB operations (invites, interests) |
| `OrganizationPrismaHelperService` | Complex Prisma queries |
| `ImgBBService` | Logo/cover image uploads |
| `PrismaService` | Database operations |
| `MailAndSmsService` | OTP delivery via SMS/email |
| `ConfigService` | Environment configuration |

---

## Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `Invite_Code_Not_Found` | 422 | No invite for this phone number |
| `Organization_Otp_Incorrect` | 400 | Wrong OTP entered |
| `Organization_Otp_Expired` | 400 | OTP TTL expired |
| `Organization_Not_Found` | 404 | Organization doesn't exist |
| `Interest_Already_Exists` | 409 | Phone already registered interest |
| `Invalid_Admin_Organization` | 403 | Not authorized for this org |

---

## Setup & Testing

### Prerequisites
- Docker containers running: `lsbbe_postgres`, `lsbbe_redis`, `lsbbe_mongodb`, `lsbbe_nginx`
- Server running on port 3003
- Test invite inserted in DB

### Quick Test
```bash
# 1. Send OTP
ORG_ID=$(curl -s -X POST http://localhost:3003/organization/otp/phone \
  -H "Content-Type: application/json" \
  -d '{"countryCode":"91","phoneNumber":"9999999999"}' | jq -r '.data')

# 2. Validate OTP (always 123456 in dev)
TOKEN=$(curl -s -X POST http://localhost:3003/organization/otp/validate \
  -H "Content-Type: application/json" \
  -d "{\"otp\":\"123456\",\"id\":\"$ORG_ID\"}" | jq -r '.data.organization.token')

# 3. Test authenticated endpoint
curl -s http://localhost:3003/organization/ \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Postman Collection
Import `postman/organization-apis.postman_collection.json` into Postman. The collection includes:
- All 11 endpoints with pre-configured headers and body
- Collection variables for `baseUrl`, `jwtToken`, `orgId`, `testPhone`
- Test scripts that auto-extract and set the JWT token
- Example responses for each endpoint

---

## Future Goals

### Phase 1: Organization Hierarchy
- [ ] Sub-organizations/branches support
- [ ] Parent-child organization relationships
- [ ] Multi-location organization management

### Phase 2: Team Management
- [ ] Team member profiles (name, role, permissions)
- [ ] Role-based access control (RBAC) expansion
- [ ] Activity audit logs per user

### Phase 3: KYC & Verification
- [ ] KYC document upload (GST, PAN, etc.)
- [ ] Verification workflow with admin approval
- [ ] Bank account verification

### Phase 4: Subscription & Billing
- [ ] Subscription tiers (free, pro, enterprise)
- [ ] Feature limits per tier
- [ ] Invoice generation

### Phase 5: Analytics & Dashboard
- [ ] Organization dashboard with KPIs
- [ ] Revenue metrics
- [ ] Campaign performance comparison

### Phase 6: API & Integration
- [ ] API key generation for organizations
- [ ] Webhook support for events
- [ ] POS system integration
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
