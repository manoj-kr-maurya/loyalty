import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class PrometheusService {
  constructor(
    @InjectMetric('http_request_total') private requestCounter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private requestDuration: Histogram<string>,
    @InjectMetric('app_memory_heap_bytes') private memoryGauge: Gauge<string>,
    @InjectMetric('http_error_total') private errorCounter: Counter<string>,
  ) {}

  // Request metrics
  incrementRequestCount(method: string, path: string, status: number) {
    this.requestCounter.inc({ method, path, status });
  }

  // Response time metrics
  observeResponseTime(method: string, path: string, duration: number) {
    this.requestDuration.observe({ method, path }, duration);
  }

  // Memory metrics
  updateMemoryMetrics() {
    const used = process.memoryUsage();
    this.memoryGauge.set(used.heapUsed);
  }

  // Error metrics
  incrementErrorCount(path: string, errorType: string) {
    this.errorCounter.inc({ path, errorType });
  }
}
