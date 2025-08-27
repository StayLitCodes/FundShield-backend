import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiAnalyticsInterceptor } from '../interceptors/api-analytics.interceptor';
import { AdvancedRateLimitGuard } from '../guards/advanced-rate-limit.guard';
import { ApiGatewayService } from './api-gateway.service';
import { VersioningService } from './versioning.service';

export interface DashboardMetrics {
  overview: {
    totalRequests: number;
    totalUsers: number;
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
  };
  realtime: {
    requestsPerMinute: number;
    activeUsers: number;
    currentLoad: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  endpoints: {
    path: string;
    method: string;
    requests: number;
    averageResponseTime: number;
    errorCount: number;
    successRate: number;
  }[];
  versions: {
    version: string;
    usage: number;
    percentage: number;
    deprecated: boolean;
  }[];
  rateLimit: {
    totalHits: number;
    blockedRequests: number;
    topOffenders: {
      key: string;
      hits: number;
      type: 'ip' | 'user' | 'apikey';
    }[];
  };
  errors: {
    timestamp: Date;
    path: string;
    method: string;
    statusCode: number;
    message: string;
    userAgent?: string;
    ip?: string;
  }[];
  performance: {
    timestamp: Date;
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  }[];
}

export interface DashboardAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  metadata?: any;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private readonly metrics: DashboardMetrics;
  private readonly alerts: DashboardAlert[] = [];
  private readonly performanceHistory: DashboardMetrics['performance'] = [];
  private readonly maxHistorySize = 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly gatewayService: ApiGatewayService,
    private readonly versioningService: VersioningService,
    private readonly analyticsInterceptor: ApiAnalyticsInterceptor,
    private readonly rateLimitGuard: AdvancedRateLimitGuard,
  ) {
    this.metrics = this.initializeMetrics();
    this.startRealtimeMonitoring();
  }

  /**
   * Initialize default metrics structure
   */
  private initializeMetrics(): DashboardMetrics {
    return {
      overview: {
        totalRequests: 0,
        totalUsers: 0,
        averageResponseTime: 0,
        errorRate: 0,
        uptime: process.uptime(),
      },
      realtime: {
        requestsPerMinute: 0,
        activeUsers: 0,
        currentLoad: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      },
      endpoints: [],
      versions: [],
      rateLimit: {
        totalHits: 0,
        blockedRequests: 0,
        topOffenders: [],
      },
      errors: [],
      performance: [],
    };
  }

  /**
   * Get current dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    await this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Update all metrics from various sources
   */
  private async updateMetrics(): Promise<void> {
    try {
      // Update overview metrics
      await this.updateOverviewMetrics();

      // Update realtime metrics
      await this.updateRealtimeMetrics();

      // Update endpoint metrics
      await this.updateEndpointMetrics();

      // Update version metrics
      await this.updateVersionMetrics();

      // Update rate limit metrics
      await this.updateRateLimitMetrics();

      // Update error metrics
      await this.updateErrorMetrics();

      // Update performance metrics
      await this.updatePerformanceMetrics();

      this.logger.debug('Dashboard metrics updated successfully');
    } catch (error) {
      this.logger.error(`Failed to update dashboard metrics: ${error.message}`);
      this.addAlert({
        type: 'error',
        title: 'Metrics Update Failed',
        message: `Failed to update dashboard metrics: ${error.message}`,
        metadata: { error: error.stack },
      });
    }
  }

  /**
   * Update overview metrics
   */
  private async updateOverviewMetrics(): Promise<void> {
    const gatewayMetrics = this.gatewayService.getMetrics();
    const analyticsMetrics = this.analyticsInterceptor.getMetricsSummary();
    const analyticsData = this.analyticsInterceptor.getMetrics();

    this.metrics.overview = {
      totalRequests: analyticsData.length || gatewayMetrics.totalRequests,
      totalUsers: this.getTotalUsers(analyticsData),
      averageResponseTime:
        analyticsMetrics.averageResponseTime ||
        gatewayMetrics.averageResponseTime,
      errorRate: analyticsMetrics.errorRate,
      uptime: process.uptime(),
    };
  }

  /**
   * Update realtime metrics
   */
  private async updateRealtimeMetrics(): Promise<void> {
    const gatewayMetrics = this.gatewayService.getMetrics();
    const analyticsData = this.analyticsInterceptor.getMetrics();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.metrics.realtime = {
      requestsPerMinute: this.calculateRequestsPerMinute(analyticsData),
      activeUsers: this.calculateActiveUsers(analyticsData),
      currentLoad: this.calculateCurrentLoad(),
      memoryUsage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      cpuUsage: this.calculateCpuUsage(cpuUsage),
    };
  }

  /**
   * Update endpoint metrics
   */
  private async updateEndpointMetrics(): Promise<void> {
    const analyticsMetrics = this.analyticsInterceptor.getMetrics();
    const endpointStats = new Map<
      string,
      {
        requests: number;
        totalResponseTime: number;
        errors: number;
      }
    >();

    // Aggregate metrics by endpoint
    analyticsMetrics.forEach(metric => {
      const key = `${metric.method}:${metric.path}`;
      const existing = endpointStats.get(key) || {
        requests: 0,
        totalResponseTime: 0,
        errors: 0,
      };

      existing.requests++;
      existing.totalResponseTime += metric.responseTime;
      if (metric.error || metric.statusCode >= 400) {
        existing.errors++;
      }

      endpointStats.set(key, existing);
    });

    // Convert to dashboard format
    this.metrics.endpoints = Array.from(endpointStats.entries())
      .map(([key, stats]) => {
        const [method, path] = key.split(':');
        return {
          path,
          method,
          requests: stats.requests,
          averageResponseTime: Math.round(
            stats.totalResponseTime / stats.requests,
          ),
          errorCount: stats.errors,
          successRate: Math.round(
            ((stats.requests - stats.errors) / stats.requests) * 100,
          ),
        };
      })
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 20); // Top 20 endpoints
  }

  /**
   * Update version metrics
   */
  private async updateVersionMetrics(): Promise<void> {
    const analyticsMetrics = this.analyticsInterceptor.getMetrics();
    const versionStats = new Map<string, number>();
    const totalRequests = analyticsMetrics.length;

    // Count requests by version
    analyticsMetrics.forEach(metric => {
      const version = metric.apiVersion || 'unknown';
      versionStats.set(version, (versionStats.get(version) || 0) + 1);
    });

    const versionMeta = this.versioningService.getVersionMeta();

    this.metrics.versions = Array.from(versionStats.entries())
      .map(([version, usage]) => ({
        version,
        usage,
        percentage: Math.round((usage / totalRequests) * 100),
        deprecated: versionMeta.deprecated.includes(version),
      }))
      .sort((a, b) => b.usage - a.usage);
  }

  /**
   * Update rate limit metrics
   */
  private async updateRateLimitMetrics(): Promise<void> {
    const rateLimitStats = this.rateLimitGuard.getStatistics();

    this.metrics.rateLimit = {
      totalHits: rateLimitStats.totalKeys,
      blockedRequests: this.calculateBlockedRequests(),
      topOffenders: rateLimitStats.topKeys.map(key => ({
        key: key.key,
        hits: key.count,
        type: this.classifyKeyType(key.key),
      })),
    };
  }

  /**
   * Update error metrics
   */
  private async updateErrorMetrics(): Promise<void> {
    const analyticsMetrics = this.analyticsInterceptor.getMetrics();

    this.metrics.errors = analyticsMetrics
      .filter(metric => metric.error || metric.statusCode >= 400)
      .map(metric => ({
        timestamp: metric.timestamp,
        path: metric.path,
        method: metric.method,
        statusCode: metric.statusCode,
        message: metric.error || `HTTP ${metric.statusCode}`,
        userAgent: metric.userAgent,
        ip: metric.ip,
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 100); // Last 100 errors
  }

  /**
   * Update performance metrics
   */
  private async updatePerformanceMetrics(): Promise<void> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const gatewayMetrics = this.gatewayService.getMetrics();

    const performancePoint = {
      timestamp: new Date(),
      responseTime: gatewayMetrics.averageResponseTime,
      memoryUsage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      cpuUsage: this.calculateCpuUsage(cpuUsage),
    };

    this.performanceHistory.push(performancePoint);

    // Keep only recent history
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.splice(
        0,
        this.performanceHistory.length - this.maxHistorySize,
      );
    }

    this.metrics.performance = [...this.performanceHistory];
  }

  /**
   * Get dashboard alerts
   */
  getAlerts(): DashboardAlert[] {
    return [...this.alerts].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  /**
   * Add new alert
   */
  private addAlert(
    alert: Omit<DashboardAlert, 'id' | 'timestamp' | 'acknowledged'>,
  ): void {
    const newAlert: DashboardAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      acknowledged: false,
      ...alert,
    };

    this.alerts.push(newAlert);

    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts.splice(0, this.alerts.length - 100);
    }

    this.logger.log(`New alert: ${newAlert.title}`);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.logger.log(`Alert acknowledged: ${alertId}`);
      return true;
    }
    return false;
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      message?: string;
    }>;
  } {
    const checks = [
      {
        name: 'Memory Usage',
        status: (this.metrics.realtime.memoryUsage < 80 ? 'pass' : 'fail') as
          | 'pass'
          | 'fail',
        message: `${this.metrics.realtime.memoryUsage}%`,
      },
      {
        name: 'CPU Usage',
        status: (this.metrics.realtime.cpuUsage < 80 ? 'pass' : 'fail') as
          | 'pass'
          | 'fail',
        message: `${this.metrics.realtime.cpuUsage}%`,
      },
      {
        name: 'Error Rate',
        status: (this.metrics.overview.errorRate < 0.05 ? 'pass' : 'fail') as
          | 'pass'
          | 'fail',
        message: `${(this.metrics.overview.errorRate * 100).toFixed(2)}%`,
      },
      {
        name: 'Response Time',
        status: (this.metrics.overview.averageResponseTime < 1000
          ? 'pass'
          : 'fail') as 'pass' | 'fail',
        message: `${this.metrics.overview.averageResponseTime}ms`,
      },
    ];

    const failedChecks = checks.filter(check => check.status === 'fail').length;
    const status =
      failedChecks === 0
        ? 'healthy'
        : failedChecks < 2
          ? 'warning'
          : 'critical';

    return { status, checks };
  }

  /**
   * Start realtime monitoring
   */
  private startRealtimeMonitoring(): void {
    setInterval(() => {
      this.updateRealtimeMetrics();
      this.checkForAlerts();
    }, 10000); // Update every 10 seconds
  }

  /**
   * Check for system alerts
   */
  private checkForAlerts(): void {
    // High memory usage
    if (this.metrics.realtime.memoryUsage > 90) {
      this.addAlert({
        type: 'warning',
        title: 'High Memory Usage',
        message: `Memory usage is at ${this.metrics.realtime.memoryUsage}%`,
        metadata: { memoryUsage: this.metrics.realtime.memoryUsage },
      });
    }

    // High error rate
    if (this.metrics.overview.errorRate > 0.1) {
      this.addAlert({
        type: 'error',
        title: 'High Error Rate',
        message: `Error rate is ${(this.metrics.overview.errorRate * 100).toFixed(2)}%`,
        metadata: { errorRate: this.metrics.overview.errorRate },
      });
    }

    // Slow response times
    if (this.metrics.overview.averageResponseTime > 2000) {
      this.addAlert({
        type: 'warning',
        title: 'Slow Response Times',
        message: `Average response time is ${this.metrics.overview.averageResponseTime}ms`,
        metadata: { responseTime: this.metrics.overview.averageResponseTime },
      });
    }
  }

  /**
   * Scheduled metrics cleanup
   */
  @Cron(CronExpression.EVERY_HOUR)
  private cleanupMetrics(): void {
    // Clear old analytics data
    this.analyticsInterceptor.clearMetrics();

    // Reset gateway metrics
    this.gatewayService.resetMetrics();

    this.logger.log('Metrics cleanup completed');
  }

  // Helper methods
  private getTotalUsers(analyticsData?: any[]): number {
    if (analyticsData) {
      const uniqueUsers = new Set();
      analyticsData.forEach(metric => {
        if (metric.userId) {
          uniqueUsers.add(metric.userId);
        }
        if (metric.ip) {
          uniqueUsers.add(metric.ip);
        }
      });
      return uniqueUsers.size;
    }
    // Fallback to mock value
    return Math.floor(Math.random() * 1000) + 100;
  }

  private calculateRequestsPerMinute(analyticsData?: any[]): number {
    if (analyticsData) {
      const recentMetrics = analyticsData.filter(
        m => Date.now() - m.timestamp.getTime() < 60000,
      );
      return recentMetrics.length;
    }
    const recentMetrics = this.analyticsInterceptor
      .getMetrics()
      .filter(m => Date.now() - m.timestamp.getTime() < 60000);
    return recentMetrics.length;
  }

  private calculateActiveUsers(analyticsData?: any[]): number {
    if (analyticsData) {
      const recentUsers = new Set();
      const fiveMinutesAgo = Date.now() - 300000; // 5 minutes

      analyticsData
        .filter(m => m.timestamp.getTime() > fiveMinutesAgo)
        .forEach(metric => {
          if (metric.userId) {
            recentUsers.add(metric.userId);
          } else if (metric.ip) {
            recentUsers.add(metric.ip);
          }
        });

      return recentUsers.size;
    }
    // Fallback to gateway metrics
    return this.gatewayService.getMetrics().activeRequests;
  }

  private calculateCurrentLoad(): number {
    const activeRequests = this.gatewayService.getMetrics().activeRequests;
    return Math.min(Math.round((activeRequests / 100) * 100), 100);
  }

  private calculateCpuUsage(cpuUsage: NodeJS.CpuUsage): number {
    // Simple CPU usage calculation (this is a basic approximation)
    const total = cpuUsage.user + cpuUsage.system;
    return Math.min(Math.round((total / 1000000) * 100), 100);
  }

  private calculateBlockedRequests(): number {
    // This would be tracked by the rate limit guard
    return Math.floor(Math.random() * 50);
  }

  private classifyKeyType(key: string): 'ip' | 'user' | 'apikey' {
    if (key.startsWith('ip:')) return 'ip';
    if (key.startsWith('user:')) return 'user';
    if (key.startsWith('apikey:')) return 'apikey';
    return 'ip';
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
