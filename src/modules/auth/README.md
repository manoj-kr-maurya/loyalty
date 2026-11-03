# Auth Module

## Overview
The Auth Module handles authentication and authorization for both Organizations and Customers in the loyalty engine. It implements JWT-based token management with Redis-backed session tracking for single-device login enforcement and OTP-based verification.

## Two Identities, Two Models

The engine serves two different kinds of identity and must not mix them.

| | Tenant admin / staff | Tenant shopper (customer) |
|---|---|---|
| Who authenticates them | This engine | The **tenant**, in its own product |
| Credentials | Username + password, then an OTP to the mobile number already on file | The tenant's own credential |
| Engine action | Verifies the password, sends the OTP, issues a session JWT | Exchanges the tenant's assertion for a short lived customer session token |
| Is the shopper ever sent an OTP by us | No | **No** |

### Tenant staff: username + password, then OTP

```
POST /organization/auth/set-credentials   (bearer JWT, once per account)
POST /organization/auth/login             { username, password } → { challengeId }
POST /organization/auth/verify-otp        { challengeId, otp } → { token }
```

- The password is hashed with **scrypt** and a per password random salt
  (`src/common/utils/password.util.ts`). The stored hash carries its own cost
  parameters so the cost can be raised without invalidating old hashes.
- Credentials may only be set **once**, by an account that is already
  authenticated.
- The OTP is always sent to the mobile number **already on file for the
  account**, never to a number supplied by the caller.
- The challenge is addressed by an opaque `challengeId`, so the account id is
  never handed back to the server. It is single use and rate limited per
  account (5 requests / 15 minutes), not per challenge.

### Customer: delegated session token

```
POST /customer/session   (x-api-key, tenant bound to the key)
  body: { externalId?, phoneNumber?, name? }
  → { token, expiresIn, customer }
```

The token is audience bound (`aud: "loyalty"`), expires in 15 minutes and
carries the tenant it was minted for:

```typescript
{
  sub: customerId,
  organizationId: tenantId,
  userType: "customer",
  aud: "loyalty",
  sessionType: "customer_session",
  iat: number,
  exp: number
}
```

It is **self contained**: no server side session is stored, so it cannot be
revoked — it simply expires. Every customer facing read is scoped by the
`organizationId` in the token.

`CustomerSessionGuard` also accepts the legacy customer JWT produced by the
deprecated shopper OTP flow; for that path the tenant is resolved from the
customer record itself, because a customer belongs to exactly one tenant.

## Current State (Implemented Features)

### Authentication Methods
- **JWT Token Generation**: 14-day token expiry with cryptographic signing
- **Delegated Customer Sessions**: 15 minute, tenant scoped, audience bound tokens with no server side session
- **Session Management**: Redis-backed session tracking per user
- **Single-Device Login**: Enforces one active session per user (sessionId stored in Redis)
- **Password Credentials**: scrypt hashed tenant staff passwords with a one time setup step
- **OTP Verification**: Phone-based OTP authentication via SMS/Email
- **Login Challenges**: Opaque, single use challenge ids for the password + OTP flow
- **Dual User Type Support**: Handles both `Organization` and `Customer` user types

### Session Features
- **Session ID Generation**: Unique session identifiers for login tracking
- **Session Caching**: Redis TTL set to 14 days matching token expiry
- **Session Validation**: Validates incoming session matches cached session
- **Logout Support**: Session invalidation

### JWT Claims
```typescript
{
  sub: entity.id,           // Subject (User ID)
  sessionId: string,        // Session tracking ID
  userType: "Organization" | "Customer",  // User type enum
  iat: number,              // Issued at
  exp: number               // Expiration (14 days)
}
```

Customer session tokens replace `sessionId` with `organizationId` + `aud` and
expire after 15 minutes.

### Error Handling
- `InvalidJWTException` - Malformed or invalid tokens
- `InvalidSessionException` - Session mismatch or expired
- `TooManyAttemptsException` - Rate limiting on failed OTP attempts

## Database Models Used
- `Organization` - For organization authentication
- `Customer` - For customer authentication
- `Invite` - For admin invitations

## External Services
- **Mail & SMS Service**: For OTP delivery
- **Cache Service**: Redis for session storage
- **JWT Service**: NestJS JWT module

## Dependencies
- `JwtService` - Token signing/verification
- `MailAndSmsService` - OTP delivery
- `CacheService` (Redis) - Session persistence
- `ConfigService` - Environment configuration
- `CommonUtilsService` - Session ID generation

## Current Implementation Details

### Generate JWT Flow
1. Generate unique sessionId via CommonUtilsService
2. Create JWT payload with sub, sessionId, userType
3. Sign token with 14-day expiry using JWT_SECRET
4. Store sessionId in Redis with 14-day TTL
5. Return signed JWT token

### Validate JWT Flow
1. Verify JWT signature against JWT_SECRET
2. Extract sessionId from JWT payload
3. Check if sessionId exists in Redis cache
4. Return decoded payload if valid

### OTP Generation Flow
1. Generate random OTP (likely 6-digit)
2. Store OTP in cache with expiry
3. Send OTP via email/SMS based on preference
4. Validate OTP against cache on verification

## What They Want to Build (Future Goals)

### Phase 1: Advanced Rate Limiting
- [ ] Rate limiting on OTP request attempts (e.g., max 5 per 24 hours per phone)
- [ ] Progressive backoff (exponential delay after failures)
- [ ] Rate limiting by IP address for API endpoints
- [ ] Implement Redis-backed rate limiter

### Phase 2: Refresh Token Strategy
- [ ] Implement refresh tokens (7-day lifespan)
- [ ] Add token refresh endpoint
- [ ] Refresh token rotation on use
- [ ] Separate RT/AT token strategies

### Phase 3: Multi-Device Sessions
- [ ] Allow multiple concurrent devices per user
- [ ] Session device tracking (device type, IP, location)
- [ ] Device management interface (see/revoke devices)
- [ ] Suspicious login detection
- [ ] Require re-authentication on new device

### Phase 4: Social & Alternative Auth
- [ ] Firebase authentication integration
- [ ] Google OAuth integration
- [ ] Apple Sign-In support
- [ ] Multi-factor authentication (2FA)

### Phase 5: Security Enhancements
- [ ] User type validation improvements (TODO: currently noted in code)
- [ ] Production OTP verification enablement (TODO: disabled block in code)
- [ ] JWT signing with asymmetric keys (RS256)
- [ ] Token blacklisting for logout
- [ ] IP whitelisting/geofencing
- [ ] Device fingerprinting
- [ ] Brute force protection with account lockout

### Phase 6: Audit & Logging
- [ ] Auth event logging (login, logout, token refresh)
- [ ] Failed authentication tracking
- [ ] Session audit trail
- [ ] Integration with Prometheus metrics
- [ ] Alert on suspicious auth patterns

## Security Notes
- **Production TODO**: OTP block requires uncomment for production
- **Validation TODO**: User type validation needs implementation
- All tokens stored server-side for stateful auth model
- Single session per device prevents session hijacking

## Configuration Required
- `JWT_SECRET`: Environment variable for token signing
- `CACHE_MANAGER`: Redis connection for session storage
- `REDIS_TTL`: Should match token expiry (14 days)

## Error Codes
- `401 Unauthorized` - Invalid JWT or session
- `429 Too Many Attempts` - Rate limit exceeded on OTP
- `400 Bad Request` - Invalid OTP or malformed request

## Notes
- Session management uses case-sensitive sessionId matching
- OTP validation is tied to authentication flow
- Email/SMS delivery handled by mail-and-sms module
- No public/private JWT differentiation currently (both same)

## 🎓 Learning Requirement

When fixing, implementing, or changing anything, the AI assistant MUST include three sections:
1. **Concept** — the underlying idea/principle.
2. **Implementation Principle / Pattern applied** — name the SOLID principle, GoF design pattern, or architecture pattern used, and where in the code (file:line).
3. **Resource** — official docs/article for learning.

Every change is a learning opportunity; never change silently.

