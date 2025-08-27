
import { Injectable } from '@nestjs/common';

export interface Alert {
  type: 'slow-request' | 'high-memory' | 'high-cpu' | 'cache-miss';
  message: string;
  timestamp: number;
  data?: any;
}

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
  private alerts: Alert[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;

  clearAlerts() {
    this.alerts = [];
  }

  clearRequests() {
    this.requests = [];
  }

  getMemoryStats() {
    return process.memoryUsage();
  }

  getCpuStats() {
    return process.cpuUsage();
  }

  recordRequest(metrics: RequestMetrics) {
    this.requests.push(metrics);
    // Optionally, aggregate or log slow requests
    if (metrics.durationMs > 1000) {
      const alert: Alert = {
        type: 'slow-request',
        message: `[Performance] Slow request: ${metrics.route} - ${metrics.durationMs}ms`,
        timestamp: Date.now(),
        data: metrics,
      };
      this.alerts.push(alert);
      console.warn(alert.message);
    }
    if (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal > 0.8) {
      const alert: Alert = {
        type: 'high-memory',
        message: `[Performance] High memory usage: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        timestamp: Date.now(),
        data: metrics.memoryUsage,
      };
      this.alerts.push(alert);
      console.warn(alert.message);
    }
    if ((metrics.cpuUsage.user + metrics.cpuUsage.system) > 1e6) {
      const alert: Alert = {
        type: 'high-cpu',
        message: `[Performance] High CPU usage: ${metrics.cpuUsage.user + metrics.cpuUsage.system}`,
        timestamp: Date.now(),
        data: metrics.cpuUsage,
      };
      this.alerts.push(alert);
      console.warn(alert.message);
    }
  }
  recordCacheHit() {
    this.cacheHits++;
  }

  recordCacheMiss() {
    this.cacheMisses++;
    this.alerts.push({
      type: 'cache-miss',
      message: '[Cache] Cache miss detected',
      timestamp: Date.now(),
    });
  }

  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total ? this.cacheHits / total : 0,
    };
  }

  getAlerts(limit = 50) {
    return this.alerts.slice(-limit);
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
