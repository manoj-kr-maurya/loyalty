# Mail-and-SMS Module

## Overview
The Mail-and-SMS Module handles all notification delivery across the loyalty platform. It supports multi-channel communication via email and SMS with template-based message composition, integrating with Nodemailer (email) and Factor2 (SMS) providers.

## Current State (Implemented Features)

### Email Sending
- **Nodemailer Integration**: SMTP-based email delivery
- **Template Support**: Customizable email templates
- **HTML/Text Mix**: Support for HTML and plain text
- **Attachments**: File attachment capability
- **BCC/CC**: Multiple recipient handling

### SMS Sending
- **Factor2 Integration**: SMS delivery via Factor2 API
- **International Numbers**: Support for various country codes
- **Message Templating**: SMS-specific message formatting
- **Delivery Tracking**: Optional SMS delivery reports

### Notification Types
- **OTP Delivery**: Send one-time passwords for verification
- **Order Confirmation**: Notify customer of order completion
- **Campaign Alerts**: Notify about campaign start/end
- **Wallet Updates**: Point balance notifications
- **System Alerts**: Critical system notifications

### Current Implementation Gaps (TODOs)
- Template selection hardcoded as 'Organization Otp'
- Sender configuration hardcoded as 'LSBONE'
- Both should be fetched from database dynamically

## External Service Integration

### Email Provider (Nodemailer)
- **Transport Type**: SMTP
- **Configuration**: 
  - Host, Port, Username, Password from env
  - TLS/SSL security support
- **Service Support**: Gmail, Outlook, custom SMTP

### SMS Provider (Factor2)
- **API Integration**: REST API calls
- **Authentication**: API key from env
- **Rate Limiting**: Subject to provider limits
- **Delivery Reports**: Webhook for delivery status

## Current Implementation Details

### OTP Sending Flow
```typescript
// TODO: Dynamically fetch these from database
const templateName = 'Organization Otp';
const from = 'LSBONE';

// Send OTP
- Generate random OTP
- Select delivery channel (email/SMS)
- Format message with OTP
- Call provider
- Store OTP in cache with expiry
```

### Supported Notification Types
```typescript
- ORGANIZATION_OTP: Organization login OTP
- CUSTOMER_OTP: Customer login OTP
- CAMPAIGN_START: Campaign activation notification
- CAMPAIGN_EXPIRY: Campaign ending soon reminder
- ORDER_CONFIRMATION: Order placed confirmation
- WALLET_CREDITED: Points added to wallet
- WALLET_DEBITED: Points deducted from wallet
- SYSTEM_ALERT: Critical system events
- VERIFICATION_EMAIL: Email address verification
```

## Database Models Used
- `NotificationTemplate` - Template definitions
- `NotificationLog` - Delivery logs
- `EmailTemplate` - Email-specific templates
- `SMSTemplate` - SMS-specific templates

## Dependencies
- `Nodemailer` - Email delivery
- `Factor2 SDK` - SMS delivery
- `ConfigService` - Environment configuration
- `Logger` - Error logging
- `CacheService` - OTP caching

## What They Want to Build (Future Goals)

### Phase 1: Template Management
- [ ] Move template names to database (TODO noted in code)
- [ ] Move sender configuration to database (TODO noted in code)
- [ ] Template version control
- [ ] Template preview before sending
- [ ] A/B testing for email subject lines
- [ ] Rich email templates with images/branding

### Phase 2: Notification Preferences
- [ ] Customer opt-in/opt-out preferences
- [ ] Channel preferences (email only, SMS only, both)
- [ ] Frequency capping (max notifications per day)
- [ ] Quiet hours (no notifications during night)
- [ ] Language preferences
- [ ] Notification categories (marketing, transactional, etc.)

### Phase 3: Advanced Email Features
- [ ] HTML email templates with Handlebars/EJS
- [ ] Email personalization (customer name, balance, etc.)
- [ ] Responsive email design
- [ ] Email signature/branding
- [ ] Inline CSS compilation
- [ ] Image optimization

### Phase 4: SMS Features
- [ ] SMS link shortening
- [ ] SMS delivery reports (delivery status)
- [ ] SMS retry logic
- [ ] Twilio/AWS SNS as fallback providers
- [ ] Bulk SMS sending
- [ ] SMS archive/compliance

### Phase 5: Delivery Optimization
- [ ] Send time optimization (best time to send)
- [ ] Retry logic with exponential backoff
- [ ] Fallback channel if primary fails
- [ ] Delivery queue management
- [ ] Performance metrics (delivery rate, open rate)

### Phase 6: Notification Engine
- [ ] Trigger-based notifications (customer action)
- [ ] Scheduled notifications (e.g., daily digest)
- [ ] Rule engine for conditional notifications
- [ ] Multi-step notification sequences
- [ ] Notification priority levels

### Phase 7: Analytics & Monitoring
- [ ] Delivery metrics (sent, delivered, bounced)
- [ ] Open rate tracking (email)
- [ ] Click tracking (email links)
- [ ] Engagement scoring
- [ ] Performance alerts
- [ ] Delivery failure investigation

### Phase 8: Compliance & Security
- [ ] GDPR compliance (consent tracking)
- [ ] CAN-SPAM compliance (email)
- [ ] Unsubscribe link handling
- [ ] Message encryption for sensitive data
- [ ] PII masking in logs
- [ ] Audit trail for all notifications

## API Endpoints
```
POST   /notifications/send-otp          - Send OTP via email/SMS
POST   /notifications/send-email        - Send email notification
POST   /notifications/send-sms          - Send SMS notification
GET    /notifications/logs              - Get notification delivery logs
GET    /notifications/templates         - List templates
POST   /notifications/templates         - Create template
PUT    /notifications/templates/:id     - Update template
DELETE /notifications/templates/:id     - Delete template

GET    /customers/:id/preferences       - Get notification preferences
PUT    /customers/:id/preferences       - Update preferences
POST   /customers/:id/unsubscribe       - Unsubscribe from notifications
```

## Configuration Required

### Email (Environment Variables)
```
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=noreply@loyalty.com
MAIL_FROM_NAME="Loyalty Engine"
```

### SMS (Environment Variables)
```
FACTOR2_API_KEY=your-api-key
FACTOR2_SENDER_ID=YOUR_SENDER_ID
```

## Error Handling
```
- EmailSendFailedException (SMTP failure)
- SMSSendFailedException (Factor2 API failure)
- InvalidPhoneNumberException (Invalid phone format)
- InvalidEmailException (Invalid email format)
- TemplateNotFoundException (Template doesn't exist)
- RateLimitExceededException (Provider rate limit)
- DeliveryTimeoutException (Provider timeout)
```

## Database Indexes
- Index: (notificationType, customerId, createdAt)
- Index: (status, createdAt) for failed notification queries
- Unique Index: (templateName, templateType)

## Quality Assurance

### Email Testing
- Send test emails before campaign launch
- Spam check integration (SpamAssassin)
- Email client preview (different browsers)
- Link validation

### SMS Testing
- SMS delivery to test numbers
- Encoding verification (UTF-8, Unicode)
- Length validation (160 chars per SMS)

## Scalability Considerations
- Queue-based sending for high volume
- Batch operations for bulk notifications
- Provider connection pooling
- Rate limiting to respect provider limits
- Caching for template retrieval

## Notes
- OTP typically 6 digits, valid for 10 minutes
- Email templates support Handlebars syntax
- SMS limited to 160 characters (or 70 for Unicode)
- Sender ID must be pre-registered with SMS provider
- Email delivery can take 1-5 minutes
- SMS delivery typically within 30 seconds
- Both services have usage/quota limits
- All notifications logged for compliance
- Sensitive data (OTP) should not be stored long-term
