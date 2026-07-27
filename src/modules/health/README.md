# Health Checks Module

This module provides health and readiness check endpoints using NestJS Terminus.

## Endpoints

- `GET /health` - General health check for all registered services
- `GET /health/readiness` - Readiness check for all registered services
- `GET /health/liveness` - Simple liveness check that the application is running

## Health Indicators

The following services are monitored:

- **PostgreSQL** (via Prisma)
- **Redis**
- **MongoDB** (placeholder implementation provided)

## Integration

The health module is integrated into the main HealthModule, which also includes Prometheus metrics.

## Adding More Health Indicators

To add more health indicators:

1. Create a new health indicator in the `indicators` directory
2. Add it to the providers in `health-check.module.ts`
3. Add it to the health check in `health-check.controller.ts`

## MongoDB Support

MongoDB support is included as a placeholder but not active. To fully implement MongoDB health checks:

1. Create a proper MongoDB service that exposes connection status
2. Inject that service into the MongoHealthIndicator
3. Add the MongoHealthIndicator to HealthCheckModule providers
4. Add it to the controller health check methods

## Usage in Kubernetes

These health endpoints are suitable for Kubernetes liveness and readiness probes:

```yaml
livenessProbe:
  httpGet:
    path: /health/liveness
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/readiness
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```
