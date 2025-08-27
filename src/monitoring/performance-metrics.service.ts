import { Injectable } from '@nestjs/common';

export interface RequestMetrics {
  route: string;
  durationMs: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  user?: string | number | null;
  ip?: string | null;
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


  getRecentRequests(limit = 100, route?: string) {
    let reqs = this.requests;
    if (route) reqs = reqs.filter(r => r.route === route);
    return reqs.slice(-limit);
  }

  getStats(route?: string) {
    let reqs = this.requests;
    if (route) reqs = reqs.filter(r => r.route === route);
    const total = reqs.length;
    if (!total) return { total: 0, avg: 0, median: 0, p95: 0, slowest: 0 };
    const durations = reqs.map(r => r.durationMs).sort((a, b) => a - b);
    const avg = durations.reduce((sum, d) => sum + d, 0) / total;
    const median = durations[Math.floor(total / 2)];
    const p95 = durations[Math.floor(total * 0.95)];
    const slowest = durations[total - 1];
    return { total, avg, median, p95, slowest };
  }
}
