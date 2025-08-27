import { Injectable } from '@nestjs/common';

interface RequestMetrics {
  route: string;
  durationMs: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

@Injectable()
export class PerformanceMetricsService {
  private requests: RequestMetrics[] = [];

  recordRequest(metrics: RequestMetrics) {
    this.requests.push(metrics);
    // Optionally, aggregate or log slow requests
    if (metrics.durationMs > 1000) {
      console.warn(`[Performance] Slow request: ${metrics.route} - ${metrics.durationMs}ms`);
    }
  }

  getRecentRequests(limit = 100) {
    return this.requests.slice(-limit);
  }

  getStats() {
    // Aggregate stats for dashboard
    const total = this.requests.length;
    const avg = total
      ? this.requests.reduce((sum, r) => sum + r.durationMs, 0) / total
      : 0;
    return { total, avg }; 
  }
}
