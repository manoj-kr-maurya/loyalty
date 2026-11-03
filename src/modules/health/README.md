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

## Integration

The health module is integrated into the main HealthModule, which also includes Prometheus metrics.

## Adding More Health Indicators

To add more health indicators:

1. Create a new health indicator in the `indicators` directory
2. Add it to the providers in `health-check.module.ts`
3. Add it to the health check in `health-check.controller.ts`

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

## 🎓 Learning Requirement

When fixing, implementing, or changing anything, the AI assistant MUST include three sections:
1. **Concept** — the underlying idea/principle.
2. **Implementation Principle / Pattern applied** — name the SOLID principle, GoF design pattern, or architecture pattern used, and where in the code (file:line).
3. **Resource** — official docs/article for learning.

Every change is a learning opportunity; never change silently.

