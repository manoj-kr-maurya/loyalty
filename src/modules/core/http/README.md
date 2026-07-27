# HTTP Module

## Overview
The HTTP Module provides HTTP client capabilities and external API integration. It wraps Axios for making outbound HTTP requests to third-party services, APIs, and webhook endpoints with error handling, retry logic, and request/response logging.

## Current State (Implemented Features)

### HTTP Client Services
- **Axios Wrapper**: Abstraction over Axios for HTTP requests
- **Request Methods**: GET, POST, PUT, DELETE, PATCH support
- **Request Configuration**: Headers, params, data, timeout
- **Response Handling**: Success, error, timeout handling
- **Error Mapping**: Map HTTP errors to business exceptions

### Integration Points
- **PhonePe Payment Gateway**: Payment processing
- **External APIs**: Third-party service calls
- **Webhooks**: Outbound webhook delivery
- **Image Service (ImgBB)**: Image upload/storage
- **Email/SMS Providers**: Direct API calls

## Configuration
- Base URL per service
- Request timeout
- Retry policy
- Auth headers
- Request/response logging

## Dependencies
- `@nestjs/axios` - HTTP client module
- `axios` - Underlying HTTP library
- `ConfigService` - Configuration
- `Logger` - Request logging

## Current Implementation Details

### HTTP Service Structure
```typescript
@Injectable()
export class HttpService {
  constructor(
    private readonly axiosService: AxiosService,
    private readonly configService: ConfigService,
    private readonly logger: Logger
  ) {}

  async makeRequest(options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    data?: any,
    headers?: Record<string, string>,
    params?: Record<string, any>,
    timeout?: number,
    retries?: number
  }): Promise<any> {
    // Implementation with error handling
  }
}
```

### Request/Response Logging
```typescript
{
  timestamp: "2024-01-15T10:30:00Z",
  method: "POST",
  url: "https://api.phonepe.com/v1/pay",
  statusCode: 200,
  duration: "234ms",
  requestSize: 512,
  responseSize: 1024
}
```

## What They Want to Build (Future Goals)

### Phase 1: Enhanced Error Handling
- [ ] Comprehensive error mapping
- [ ] Retry logic with exponential backoff
- [ ] Circuit breaker for failing endpoints
- [ ] Timeout handling
- [ ] Rate limit handling (429 errors)

### Phase 2: Request/Response Management
- [ ] Request signing (for secure APIs)
- [ ] Response caching
- [ ] Request deduplication
- [ ] Bulk request batching
- [ ] Request queuing

### Phase 3: Logging & Monitoring
- [ ] Detailed request/response logging
- [ ] PII masking in logs
- [ ] Performance metrics
- [ ] Slow request alerting
- [ ] Request tracing correlation IDs

### Phase 4: Authentication
- [ ] API key management
- [ ] OAuth 2.0 flow
- [ ] JWT token refresh
- [ ] HMAC signing
- [ ] mTLS support

### Phase 5: Testing & Debugging
- [ ] Mock HTTP responses for testing
- [ ] Request/response playback
- [ ] Development proxy mode
- [ ] Request inspection UI
- [ ] Load testing utilities

### Phase 6: Advanced Features
- [ ] GraphQL client support
- [ ] WebSocket connections
- [ ] Server-sent events (SSE)
- [ ] Streaming responses
- [ ] Upload progress tracking

### Phase 7: Integration Patterns
- [ ] Webhook management (outbound)
- [ ] Event delivery with retries
- [ ] Subscription management
- [ ] Delivery status tracking
- [ ] Webhook replay capability

### Phase 8: Observability
- [ ] Distributed tracing
- [ ] Prometheus metrics
- [ ] Jaeger integration
- [ ] Service dependency mapping
- [ ] Performance benchmarking

## API Service Integrations

### PhonePe Payment Gateway
```typescript
{
  baseUrl: "https://api.phonepe.com",
  endpoints: {
    pay: "/v1/pay",
    status: "/v1/status",
    refund: "/v1/refund"
  },
  auth: "HMAC_SHA256"
}
```

### ImgBB Image Service
```typescript
{
  baseUrl: "https://api.imgbb.com",
  endpoints: {
    upload: "/1/upload"
  },
  auth: "API_KEY"
}
```

### Email Provider
```typescript
{
  baseUrl: "https://smtp-service.example.com",
  endpoints: {
    send: "/send"
  },
  auth: "BEARER_TOKEN"
}
```

### SMS Provider (Factor2)
```typescript
{
  baseUrl: "https://api.factor2.com",
  endpoints: {
    send: "/sms/send"
  },
  auth: "API_KEY"
}
```

## Error Handling

```
- NetworkErrorException (connection failed)
- TimeoutException (request timeout)
- HTTPStatusException (4xx, 5xx responses)
- ValidationException (invalid request)
- AuthenticationException (401, 403)
- RateLimitException (429)
- ServiceUnavailableException (503)
```

## Configuration

```env
# HTTP Timeouts
HTTP_REQUEST_TIMEOUT=10000        # milliseconds
HTTP_CONNECT_TIMEOUT=5000

# Retry Policy
HTTP_MAX_RETRIES=3
HTTP_RETRY_DELAY=1000

# Rate Limiting
HTTP_RATE_LIMIT_REQUESTS=100
HTTP_RATE_LIMIT_WINDOW=60000      # milliseconds

# Service Endpoints
PHONEPE_BASE_URL=https://api.phonepe.com
PHONEPE_MERCHANT_ID=your-merchant-id
PHONEPE_SALT_KEY=your-salt-key

IMGBB_API_KEY=your-imgbb-key
```

## Request Lifecycle

1. **Request Validation**: Validate URL, method, headers
2. **Retry Loop**: Execute with configurable retries
3. **Request Execution**: Send HTTP request
4. **Response Handling**: Parse response, check status
5. **Error Handling**: Map errors to exceptions
6. **Logging**: Log request/response for audit
7. **Return**: Return parsed response or throw exception

## Retry Strategy

```
Attempt 1: Immediate
Attempt 2: Wait 1 second
Attempt 3: Wait 2 seconds
Attempt 4: Wait 4 seconds
...
Exponential backoff: delay = initialDelay * (2 ^ attemptNumber)
```

## Circuit Breaker Pattern

```
CLOSED: Normal operation
↓ (failures exceed threshold)
OPEN: Reject requests immediately
↓ (timeout elapsed)
HALF_OPEN: Allow single request to test
↓ (success)
CLOSED: Resume normal operation
↓ (failure)
OPEN: Back to open
```

## Monitoring & Metrics

### Prometheus Metrics
```
http_request_total{method="POST", endpoint="/v1/pay"} 1000
http_request_duration_seconds{endpoint="/v1/pay"} 0.234
http_errors_total{status="500"} 5
http_timeouts_total 2
```

### Dashboard Metrics
- Request count per endpoint
- Average response time
- Error rate
- Timeout rate
- Retry rate

## Best Practices

### Request Design
- Use appropriate timeouts
- Implement idempotent operations
- Handle partial failures
- Validate responses
- Log sensitive redacted data

### Error Handling
- Distinguish between transient and permanent errors
- Retry transient errors
- Alert on permanent errors
- Maintain error context
- Provide useful error messages

### Performance
- Use connection pooling
- Implement request batching
- Cache responses when applicable
- Use CDN for static resources
- Monitor slow requests

## Integration Testing

### Mock Responses
```typescript
// For testing
mockHttpService.get('/v1/status').returns(successResponse);
mockHttpService.post('/v1/pay').throws(timeoutError);
```

### Load Testing
```typescript
// Simulate high load
loadTest({
  method: 'POST',
  url: '/v1/pay',
  concurrency: 100,
  duration: 60000
});
```

## Security Considerations
- Validate HTTPS in production
- Use API keys from environment
- Implement request signing where needed
- Mask PII in logs
- Validate SSL certificates
- Implement CORS policies

## Notes
- All requests logged for debugging
- Sensitive data should be masked
- Connection pooling enabled by default
- Timeouts prevent hanging requests
- Retry logic prevents transient failures
- Consider rate limits of external services
