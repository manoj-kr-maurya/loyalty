import { Module } from '@nestjs/common';
import {
  PrometheusController,
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { PrometheusService } from './prometheus/prometheus.service';
import { CustomCacheModule } from 'src/common/services/cache/cache.module';
import { HealthCheckModule } from './health-check.module';

@Module({
  imports: [
    PrometheusModule.register({
      defaultLabels: {
        app: 'nestjs-app',
      },
    }),
    CustomCacheModule,
    HealthCheckModule,
  ],
  controllers: [PrometheusController],
  providers: [
    PrometheusService,
    makeCounterProvider({
      name: 'http_request_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.1, 0.5, 1, 2, 5], // You can adjust these buckets as needed
    }),
    makeGaugeProvider({
      name: 'app_memory_heap_bytes',
      help: 'Node.js heap size in bytes',
    }),
    makeCounterProvider({
      name: 'http_error_total',
      help: 'Total number of HTTP errors',
      labelNames: ['path', 'errorType'],
    }),
    makeGaugeProvider({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['service', 'method'],
    }),
    makeGaugeProvider({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['service', 'method'],
    }),
  ],
  exports: [PrometheusService], // Export the service if you need to use it in other modules
})
export class HealthModule {}
