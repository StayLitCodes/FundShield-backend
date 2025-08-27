import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiAnalyticsInterceptor } from '../interceptors/api-analytics.interceptor';
import { AdvancedRateLimitGuard } from '../guards/advanced-rate-limit.guard';
import { DashboardService } from './dashboard.service';
import { ApiGatewayService } from './api-gateway.service';
import { VersioningService } from './versioning.service';

export interface AnalyticsSnapshot {
  timestamp: Date;
  metrics: {
    totalRequests: number;
    uniqueUsers: number;
    averageResponseTime: number;
    errorRate: number;
    topEndpoints: Array<{
      path: string;
      method: string;
      requests: number;
      averageResponseTime: number;
    }>;
    versionDistribution: Array<{
      version: string;
      percentage: number;
      requestCount: number;
    }>;
    rateLimitingStats: {
      totalBlocked: number;
      topOffenders: Array<{
        identifier: string;
        blockedCount: number;
        type: 'ip' | 'user' | 'apikey';
      }>;
    };
    performanceMetrics: {
      memoryUsage: number;
      cpuUsage: number;
      activeConnections: number;
    };
  };
}

export interface AnalyticsTrend {
  metric: string;
  timeframe: '1h' | '24h' | '7d' | '30d';
  data: Array<{
    timestamp: Date;
    value: number;
  }>;
  trend: 'up' | 'down' | 'stable';
  changePercentage: number;
}

export interface AnalyticsReport {
  id: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalRequests: number;
    uniqueUsers: number;
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
  };
  trends: AnalyticsTrend[];
  insights: Array<{
    type: 'warning' | 'info' | 'success';
    title: string;
    description: string;
    actionable: boolean;
    recommendation?: string;
  }>;
  rawData: AnalyticsSnapshot[];
}

@Injectable()
export class AnalyticsIntegrationService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsIntegrationService.name);
  private readonly snapshots: AnalyticsSnapshot[] = [];
  private readonly maxSnapshots = 10000; // Keep last 10k snapshots
  private isInitialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly analyticsInterceptor: ApiAnalyticsInterceptor,
    private readonly rateLimitGuard: AdvancedRateLimitGuard,
    private readonly dashboardService: DashboardService,
    private readonly gatewayService: ApiGatewayService,
    private readonly versioningService: VersioningService,
  ) {}

  async onModuleInit() {
    await this.initializeIntegration();
    this.startPeriodicSnapshot();
    this.isInitialized = true;
    this.logger.log('Analytics integration service initialized');
  }

  /**
   * Initialize analytics integration
   */
  private async initializeIntegration(): Promise<void> {
    try {
      // Take initial snapshot
      await this.takeSnapshot();

      // Setup data validation
      this.validateDataSources();

      this.logger.log('Analytics integration initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize analytics integration: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Validate all data sources are available
   */
  private validateDataSources(): void {
    const sources = [
      { name: 'Analytics Interceptor', service: this.analyticsInterceptor },
      { name: 'Rate Limit Guard', service: this.rateLimitGuard },
      { name: 'Dashboard Service', service: this.dashboardService },
      { name: 'Gateway Service', service: this.gatewayService },
      { name: 'Versioning Service', service: this.versioningService },
    ];

    sources.forEach(source => {
      if (!source.service) {
        throw new Error(`Required service not available: ${source.name}`);
      }
    });

    this.logger.log('All analytics data sources validated successfully');
  }

  /**
   * Take a snapshot of current analytics data
   */
  async takeSnapshot(): Promise<AnalyticsSnapshot> {
    try {
      const timestamp = new Date();

      // Gather data from all sources
      const analyticsMetrics = this.analyticsInterceptor.getMetrics();
      const analyticsSummary = this.analyticsInterceptor.getMetricsSummary();
      const rateLimitStats = this.rateLimitGuard.getStatistics();
      const gatewayMetrics = this.gatewayService.getMetrics();
      const versionMeta = this.versioningService.getVersionMeta();

      // Calculate unique users
      const uniqueUsers = new Set();
      analyticsMetrics.forEach(metric => {
        if (metric.userId) uniqueUsers.add(metric.userId);
        else if (metric.ip) uniqueUsers.add(metric.ip);
      });

      // Calculate top endpoints
      const endpointStats = new Map<
        string,
        { requests: number; totalResponseTime: number }
      >();
      analyticsMetrics.forEach(metric => {
        const key = `${metric.method}:${metric.path}`;
        const existing = endpointStats.get(key) || {
          requests: 0,
          totalResponseTime: 0,
        };
        existing.requests++;
        existing.totalResponseTime += metric.responseTime;
        endpointStats.set(key, existing);
      });

      const topEndpoints = Array.from(endpointStats.entries())
        .map(([key, stats]) => {
          const [method, path] = key.split(':');
          return {
            path,
            method,
            requests: stats.requests,
            averageResponseTime: Math.round(
              stats.totalResponseTime / stats.requests,
            ),
          };
        })
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 10);

      // Calculate version distribution
      const versionCounts = new Map<string, number>();
      analyticsMetrics.forEach(metric => {
        const version = metric.apiVersion || 'unknown';
        versionCounts.set(version, (versionCounts.get(version) || 0) + 1);
      });

      const totalRequests = analyticsMetrics.length;
      const versionDistribution = Array.from(versionCounts.entries())
        .map(([version, count]) => ({
          version,
          percentage: Math.round((count / totalRequests) * 100),
          requestCount: count,
        }))
        .sort((a, b) => b.requestCount - a.requestCount);

      // Get system metrics
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      const snapshot: AnalyticsSnapshot = {
        timestamp,
        metrics: {
          totalRequests,
          uniqueUsers: uniqueUsers.size,
          averageResponseTime: analyticsSummary.averageResponseTime,
          errorRate: analyticsSummary.errorRate,
          topEndpoints,
          versionDistribution,
          rateLimitingStats: {
            totalBlocked: rateLimitStats.blockedRequests || 0,
            topOffenders: rateLimitStats.topKeys.map(key => ({
              identifier: key.key,
              blockedCount: key.count,
              type: this.classifyRateLimitKey(key.key),
            })),
          },
          performanceMetrics: {
            memoryUsage: Math.round(
              (memUsage.heapUsed / memUsage.heapTotal) * 100,
            ),
            cpuUsage: this.calculateCpuUsage(cpuUsage),
            activeConnections: gatewayMetrics.activeRequests,
          },
        },
      };

      // Store snapshot
      this.snapshots.push(snapshot);

      // Cleanup old snapshots
      if (this.snapshots.length > this.maxSnapshots) {
        this.snapshots.splice(0, this.snapshots.length - this.maxSnapshots);
      }

      this.logger.debug(
        `Analytics snapshot taken: ${totalRequests} requests, ${uniqueUsers.size} unique users`,
      );

      return snapshot;
    } catch (error) {
      this.logger.error(`Failed to take analytics snapshot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get analytics trends for specified metrics
   */
  getAnalyticsTrends(
    metrics: string[],
    timeframe: '1h' | '24h' | '7d' | '30d' = '24h',
  ): AnalyticsTrend[] {
    const timeframeMills = this.getTimeframeMilliseconds(timeframe);
    const cutoffTime = new Date(Date.now() - timeframeMills);

    const relevantSnapshots = this.snapshots.filter(
      snapshot => snapshot.timestamp >= cutoffTime,
    );

    if (relevantSnapshots.length < 2) {
      return []; // Need at least 2 data points for trends
    }

    return metrics.map(metric => {
      const data = relevantSnapshots.map(snapshot => ({
        timestamp: snapshot.timestamp,
        value: this.extractMetricValue(snapshot, metric),
      }));

      // Calculate trend
      const firstValue = data[0].value;
      const lastValue = data[data.length - 1].value;
      const changePercentage =
        firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (Math.abs(changePercentage) > 5) {
        trend = changePercentage > 0 ? 'up' : 'down';
      }

      return {
        metric,
        timeframe,
        data,
        trend,
        changePercentage: Math.round(changePercentage * 100) / 100,
      };
    });
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport(period: {
    start: Date;
    end: Date;
  }): Promise<AnalyticsReport> {
    const relevantSnapshots = this.snapshots.filter(
      snapshot =>
        snapshot.timestamp >= period.start && snapshot.timestamp <= period.end,
    );

    if (relevantSnapshots.length === 0) {
      throw new Error('No data available for the specified period');
    }

    // Calculate summary statistics
    const totalRequests = relevantSnapshots.reduce(
      (sum, s) => sum + s.metrics.totalRequests,
      0,
    );
    const uniqueUsers = new Set();
    const responseTimes: number[] = [];
    const errorRates: number[] = [];

    relevantSnapshots.forEach(snapshot => {
      // Track unique users across all snapshots
      snapshot.metrics.uniqueUsers &&
        uniqueUsers.add(snapshot.metrics.uniqueUsers);
      responseTimes.push(snapshot.metrics.averageResponseTime);
      errorRates.push(snapshot.metrics.errorRate);
    });

    const averageResponseTime =
      responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
    const averageErrorRate =
      errorRates.reduce((sum, er) => sum + er, 0) / errorRates.length;
    const uptime = this.calculateUptimePercentage(relevantSnapshots);

    // Generate trends
    const trends = this.getAnalyticsTrends(
      ['totalRequests', 'averageResponseTime', 'errorRate', 'memoryUsage'],
      '24h',
    );

    // Generate insights
    const insights = this.generateInsights(relevantSnapshots, trends);

    const report: AnalyticsReport = {
      id: this.generateReportId(),
      generatedAt: new Date(),
      period,
      summary: {
        totalRequests,
        uniqueUsers: uniqueUsers.size,
        averageResponseTime: Math.round(averageResponseTime),
        errorRate: Math.round(averageErrorRate * 10000) / 100, // As percentage
        uptime,
      },
      trends,
      insights,
      rawData: relevantSnapshots,
    };

    this.logger.log(
      `Analytics report generated: ${report.id} for period ${period.start.toISOString()} to ${period.end.toISOString()}`,
    );

    return report;
  }

  /**
   * Get current analytics dashboard data
   */
  async getCurrentDashboardData(): Promise<any> {
    const latestSnapshot = this.snapshots[this.snapshots.length - 1];
    if (!latestSnapshot) {
      await this.takeSnapshot();
      return this.snapshots[this.snapshots.length - 1];
    }

    // If snapshot is older than 5 minutes, take a new one
    const fiveMinutesAgo = Date.now() - 300000;
    if (latestSnapshot.timestamp.getTime() < fiveMinutesAgo) {
      await this.takeSnapshot();
      return this.snapshots[this.snapshots.length - 1];
    }

    return latestSnapshot;
  }

  /**
   * Get analytics data for specific time range
   */
  getAnalyticsData(
    startTime: Date,
    endTime: Date,
    aggregation: 'minute' | 'hour' | 'day' = 'hour',
  ): AnalyticsSnapshot[] {
    const filtered = this.snapshots.filter(
      snapshot =>
        snapshot.timestamp >= startTime && snapshot.timestamp <= endTime,
    );

    // Apply aggregation if needed
    if (aggregation !== 'minute') {
      return this.aggregateSnapshots(filtered, aggregation);
    }

    return filtered;
  }

  /**
   * Start periodic snapshot collection
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  private async startPeriodicSnapshot(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.takeSnapshot();
    } catch (error) {
      this.logger.error(`Periodic snapshot failed: ${error.message}`);
    }
  }

  /**
   * Cleanup old data
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const initialLength = this.snapshots.length;

    const filteredSnapshots = this.snapshots.filter(
      snapshot => snapshot.timestamp >= cutoffTime,
    );

    this.snapshots.length = 0;
    this.snapshots.push(...filteredSnapshots);

    const removed = initialLength - this.snapshots.length;
    if (removed > 0) {
      this.logger.log(`Cleaned up ${removed} old analytics snapshots`);
    }
  }

  // Helper methods
  private getTimeframeMilliseconds(timeframe: string): number {
    const timeframes = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return timeframes[timeframe] || timeframes['24h'];
  }

  private extractMetricValue(
    snapshot: AnalyticsSnapshot,
    metric: string,
  ): number {
    switch (metric) {
      case 'totalRequests':
        return snapshot.metrics.totalRequests;
      case 'averageResponseTime':
        return snapshot.metrics.averageResponseTime;
      case 'errorRate':
        return snapshot.metrics.errorRate;
      case 'memoryUsage':
        return snapshot.metrics.performanceMetrics.memoryUsage;
      case 'cpuUsage':
        return snapshot.metrics.performanceMetrics.cpuUsage;
      case 'uniqueUsers':
        return snapshot.metrics.uniqueUsers;
      default:
        return 0;
    }
  }

  private calculateCpuUsage(cpuUsage: NodeJS.CpuUsage): number {
    const total = cpuUsage.user + cpuUsage.system;
    return Math.min(Math.round((total / 1000000) * 100), 100);
  }

  private classifyRateLimitKey(key: string): 'ip' | 'user' | 'apikey' {
    if (key.startsWith('ip:')) return 'ip';
    if (key.startsWith('user:')) return 'user';
    if (key.startsWith('apikey:')) return 'apikey';
    return 'ip';
  }

  private calculateUptimePercentage(snapshots: AnalyticsSnapshot[]): number {
    // Simple uptime calculation based on successful health checks
    const totalSnapshots = snapshots.length;
    const healthySnapshots = snapshots.filter(
      s => s.metrics.errorRate < 0.1,
    ).length;
    return Math.round((healthySnapshots / totalSnapshots) * 100);
  }

  private generateInsights(
    snapshots: AnalyticsSnapshot[],
    trends: AnalyticsTrend[],
  ): any[] {
    const insights = [];

    // Analyze error rate trend
    const errorTrend = trends.find(t => t.metric === 'errorRate');
    if (
      errorTrend &&
      errorTrend.trend === 'up' &&
      errorTrend.changePercentage > 50
    ) {
      insights.push({
        type: 'warning',
        title: 'Increasing Error Rate',
        description: `Error rate has increased by ${errorTrend.changePercentage.toFixed(1)}% over the last ${errorTrend.timeframe}`,
        actionable: true,
        recommendation:
          'Review recent deployments and check error logs for patterns',
      });
    }

    // Analyze response time trend
    const responseTrend = trends.find(t => t.metric === 'averageResponseTime');
    if (
      responseTrend &&
      responseTrend.trend === 'up' &&
      responseTrend.changePercentage > 25
    ) {
      insights.push({
        type: 'warning',
        title: 'Response Time Degradation',
        description: `Average response time has increased by ${responseTrend.changePercentage.toFixed(1)}%`,
        actionable: true,
        recommendation:
          'Consider optimizing slow endpoints or scaling infrastructure',
      });
    }

    // Analyze request volume
    const requestTrend = trends.find(t => t.metric === 'totalRequests');
    if (
      requestTrend &&
      requestTrend.trend === 'up' &&
      requestTrend.changePercentage > 100
    ) {
      insights.push({
        type: 'info',
        title: 'Traffic Surge Detected',
        description: `Request volume has increased by ${requestTrend.changePercentage.toFixed(1)}%`,
        actionable: true,
        recommendation:
          'Monitor system resources and consider auto-scaling if available',
      });
    }

    return insights;
  }

  private aggregateSnapshots(
    snapshots: AnalyticsSnapshot[],
    aggregation: 'hour' | 'day',
  ): AnalyticsSnapshot[] {
    // Simple aggregation - group by hour or day and average the metrics
    const aggregated = new Map<string, AnalyticsSnapshot[]>();

    snapshots.forEach(snapshot => {
      const key =
        aggregation === 'hour'
          ? `${snapshot.timestamp.getFullYear()}-${snapshot.timestamp.getMonth()}-${snapshot.timestamp.getDate()}-${snapshot.timestamp.getHours()}`
          : `${snapshot.timestamp.getFullYear()}-${snapshot.timestamp.getMonth()}-${snapshot.timestamp.getDate()}`;

      if (!aggregated.has(key)) {
        aggregated.set(key, []);
      }
      aggregated.get(key)!.push(snapshot);
    });

    return Array.from(aggregated.values()).map(group => {
      // Average the metrics in each group
      const firstSnapshot = group[0];
      const avgMetrics = {
        ...firstSnapshot.metrics,
        totalRequests:
          group.reduce((sum, s) => sum + s.metrics.totalRequests, 0) /
          group.length,
        averageResponseTime:
          group.reduce((sum, s) => sum + s.metrics.averageResponseTime, 0) /
          group.length,
        errorRate:
          group.reduce((sum, s) => sum + s.metrics.errorRate, 0) / group.length,
      };

      return {
        ...firstSnapshot,
        metrics: avgMetrics,
      };
    });
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
