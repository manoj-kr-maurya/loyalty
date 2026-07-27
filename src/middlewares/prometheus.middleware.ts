import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrometheusService } from 'src/modules/health/prometheus/prometheus.service';

@Injectable()
export class PrometheusMiddleware implements NestMiddleware {
  constructor(private metricsService: PrometheusService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;

      this.metricsService.incrementRequestCount(
        req.method,
        req.path,
        res.statusCode,
      );

      this.metricsService.observeResponseTime(
        req.method,
        req.path,
        duration / 1000, // Convert to seconds
      );

      if (res.statusCode >= 400) {
        this.metricsService.incrementErrorCount(req.path, `${res.statusCode}`);
      }

      // Update memory metrics periodically
      this.metricsService.updateMemoryMetrics();
    });

    next();
  }
}
