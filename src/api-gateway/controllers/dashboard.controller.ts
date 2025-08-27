import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  UseGuards,
  Logger,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable, interval, map } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  DashboardService,
  DashboardMetrics,
  DashboardAlert,
} from '../services/dashboard.service';
import { VersionNeutral } from '../decorators/versioning.decorators';
import {
  ApiOperationEnhanced,
  ApiResponseEnhanced,
  ApiErrorResponses,
  ApiAuthRequired,
  ApiQueryEnhanced,
  ApiParamEnhanced,
} from '../decorators/api-docs.decorators';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

class AlertAcknowledgeDto {
  alertId: string;
}

class DashboardFilterDto {
  timeRange?: '1h' | '24h' | '7d' | '30d';
  endpoint?: string;
  version?: string;
  status?: 'success' | 'error' | 'all';
}

@ApiTags('Dashboard')
@Controller('api/dashboard')
@VersionNeutral()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @Roles('admin', 'moderator')
  @ApiOperationEnhanced({
    summary: 'Get Dashboard Metrics',
    description:
      'Retrieve comprehensive dashboard metrics including overview, realtime data, endpoint statistics, version usage, rate limiting, errors, and performance data.',
    tags: ['Dashboard', 'Metrics'],
  })
  @ApiQueryEnhanced({
    name: 'timeRange',
    description: 'Time range for metrics aggregation',
    required: false,
    enum: ['1h', '24h', '7d', '30d'],
    example: '24h',
  })
  @ApiQueryEnhanced({
    name: 'refresh',
    description: 'Force refresh of metrics data',
    required: false,
    type: 'boolean',
    example: false,
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Dashboard metrics retrieved successfully',
  })
  @ApiErrorResponses()
  async getMetrics(
    @Query('timeRange') timeRange?: string,
    @Query('refresh') refresh?: boolean,
  ): Promise<{
    success: boolean;
    data: DashboardMetrics;
    metadata: {
      lastUpdated: Date;
      timeRange: string;
      refreshed: boolean;
    };
  }> {
    this.logger.log(
      `Dashboard metrics requested with timeRange: ${timeRange}, refresh: ${refresh}`,
    );

    const metrics = await this.dashboardService.getDashboardMetrics();

    return {
      success: true,
      data: metrics,
      metadata: {
        lastUpdated: new Date(),
        timeRange: timeRange || 'default',
        refreshed: refresh || false,
      },
    };
  }

  @Get('overview')
  @Roles('admin', 'moderator', 'user')
  @ApiOperationEnhanced({
    summary: 'Get Dashboard Overview',
    description:
      'Get high-level overview metrics for the dashboard including total requests, users, response times, and error rates.',
    tags: ['Dashboard', 'Overview'],
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Dashboard overview retrieved successfully',
  })
  async getOverview(): Promise<{
    success: boolean;
    data: DashboardMetrics['overview'];
  }> {
    const metrics = await this.dashboardService.getDashboardMetrics();

    return {
      success: true,
      data: metrics.overview,
    };
  }

  @Get('realtime')
  @Roles('admin', 'moderator')
  @ApiOperationEnhanced({
    summary: 'Get Realtime Metrics',
    description:
      'Get real-time system metrics including current requests, active users, system load, memory, and CPU usage.',
    tags: ['Dashboard', 'Realtime'],
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Realtime metrics retrieved successfully',
  })
  async getRealtimeMetrics(): Promise<{
    success: boolean;
    data: DashboardMetrics['realtime'];
    timestamp: Date;
  }> {
    const metrics = await this.dashboardService.getDashboardMetrics();

    return {
      success: true,
      data: metrics.realtime,
      timestamp: new Date(),
    };
  }

  @Sse('realtime/stream')
  @Roles('admin', 'moderator')
  @ApiOperationEnhanced({
    summary: 'Realtime Metrics Stream',
    description:
      'Server-Sent Events stream for real-time dashboard metrics updates. Updates every 5 seconds with live analytics data.',
    tags: ['Dashboard', 'Realtime', 'SSE'],
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream established',
    headers: {
      'Content-Type': { description: 'text/event-stream' },
      'Cache-Control': { description: 'no-cache' },
      Connection: { description: 'keep-alive' },
    },
  })
  getRealtimeStream(): Observable<MessageEvent> {
    this.logger.log('Realtime metrics stream started');

    return interval(5000).pipe(
      map(async () => {
        try {
          const metrics = await this.dashboardService.getDashboardMetrics();
          const healthStatus = this.dashboardService.getHealthStatus();
          const alerts = this.dashboardService.getAlerts().slice(0, 5); // Last 5 alerts

          return {
            data: {
              realtime: metrics.realtime,
              overview: metrics.overview,
              health: healthStatus,
              recentAlerts: alerts.filter(a => !a.acknowledged),
              timestamp: new Date().toISOString(),
              version: process.env.npm_package_version || '1.0.0',
            },
            type: 'metrics-update',
            id: `update-${Date.now()}`,
          } as MessageEvent;
        } catch (error) {
          this.logger.error(
            `Error generating realtime metrics: ${error.message}`,
          );
          return {
            data: {
              error: 'Failed to fetch metrics',
              timestamp: new Date().toISOString(),
            },
            type: 'error',
            id: `error-${Date.now()}`,
          } as MessageEvent;
        }
      }),
    );
  }

  @Get('endpoints')
  @Roles('admin', 'moderator')
  @ApiOperationEnhanced({
    summary: 'Get Endpoint Statistics',
    description:
      'Get detailed statistics for API endpoints including request counts, response times, error rates, and success rates.',
    tags: ['Dashboard', 'Endpoints'],
  })
  @ApiQueryEnhanced({
    name: 'limit',
    description: 'Number of top endpoints to return',
    required: false,
    type: 'number',
    example: 20,
  })
  @ApiQueryEnhanced({
    name: 'sortBy',
    description: 'Sort endpoints by specific metric',
    required: false,
    enum: ['requests', 'responseTime', 'errorRate'],
    example: 'requests',
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Endpoint statistics retrieved successfully',
  })
  async getEndpointStats(
    @Query('limit') limit = 20,
    @Query('sortBy') sortBy = 'requests',
  ): Promise<{
    success: boolean;
    data: DashboardMetrics['endpoints'];
    metadata: {
      total: number;
      sortBy: string;
      limit: number;
    };
  }> {
    const metrics = await this.dashboardService.getDashboardMetrics();
    let endpoints = [...metrics.endpoints];

    // Sort by specified metric
    switch (sortBy) {
      case 'responseTime':
        endpoints.sort((a, b) => b.averageResponseTime - a.averageResponseTime);
        break;
      case 'errorRate':
        endpoints.sort(
          (a, b) => b.errorCount / b.requests - a.errorCount / a.requests,
        );
        break;
      default:
        endpoints.sort((a, b) => b.requests - a.requests);
    }

    // Apply limit
    endpoints = endpoints.slice(0, Math.min(limit, endpoints.length));

    return {
      success: true,
      data: endpoints,
      metadata: {
        total: metrics.endpoints.length,
        sortBy,
        limit,
      },
    };
  }

  @Get('versions')
  @Roles('admin', 'moderator')
  @ApiOperationEnhanced({
    summary: 'Get API Version Usage',
    description:
      'Get statistics on API version usage including request counts, percentages, and deprecation status.',
    tags: ['Dashboard', 'Versions'],
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Version usage statistics retrieved successfully',
  })
  async getVersionStats(): Promise<{
    success: boolean;
    data: DashboardMetrics['versions'];
    metadata: {
      totalVersions: number;
      deprecatedCount: number;
    };
  }> {
    const metrics = await this.dashboardService.getDashboardMetrics();
    const deprecatedCount = metrics.versions.filter(v => v.deprecated).length;

    return {
      success: true,
      data: metrics.versions,
      metadata: {
        totalVersions: metrics.versions.length,
        deprecatedCount,
      },
    };
  }

  @Get('rate-limits')
  @Roles('admin')
  @ApiOperationEnhanced({
    summary: 'Get Rate Limiting Statistics',
    description:
      'Get comprehensive rate limiting statistics including total hits, blocked requests, and top offenders.',
    tags: ['Dashboard', 'Rate Limiting'],
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Rate limiting statistics retrieved successfully',
  })
  async getRateLimitStats(): Promise<{
    success: boolean;
    data: DashboardMetrics['rateLimit'];
  }> {
    const metrics = await this.dashboardService.getDashboardMetrics();

    return {
      success: true,
      data: metrics.rateLimit,
    };
  }

  @Get('errors')
  @Roles('admin', 'moderator')
  @ApiOperationEnhanced({
    summary: 'Get Error Statistics',
    description:
      'Get recent API errors including timestamps, paths, status codes, and error messages.',
    tags: ['Dashboard', 'Errors'],
  })
  @ApiQueryEnhanced({
    name: 'limit',
    description: 'Number of recent errors to return',
    required: false,
    type: 'number',
    example: 50,
  })
  @ApiQueryEnhanced({
    name: 'statusCode',
    description: 'Filter by specific HTTP status code',
    required: false,
    type: 'number',
    example: 500,
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Error statistics retrieved successfully',
  })
  async getErrors(
    @Query('limit') limit = 50,
    @Query('statusCode') statusCode?: number,
  ): Promise<{
    success: boolean;
    data: DashboardMetrics['errors'];
    metadata: {
      total: number;
      filtered: number;
    };
  }> {
    const metrics = await this.dashboardService.getDashboardMetrics();
    let errors = [...metrics.errors];

    // Filter by status code if provided
    if (statusCode) {
      errors = errors.filter(error => error.statusCode === statusCode);
    }

    // Apply limit
    const filteredErrors = errors.slice(0, Math.min(limit, errors.length));

    return {
      success: true,
      data: filteredErrors,
      metadata: {
        total: metrics.errors.length,
        filtered: filteredErrors.length,
      },
    };
  }

  @Get('performance')
  @Roles('admin', 'moderator')
  @ApiOperationEnhanced({
    summary: 'Get Performance History',
    description:
      'Get historical performance data including response times, memory usage, and CPU usage over time.',
    tags: ['Dashboard', 'Performance'],
  })
  @ApiQueryEnhanced({
    name: 'hours',
    description: 'Number of hours of history to return',
    required: false,
    type: 'number',
    example: 24,
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Performance history retrieved successfully',
  })
  async getPerformanceHistory(@Query('hours') hours = 24): Promise<{
    success: boolean;
    data: DashboardMetrics['performance'];
    metadata: {
      timeRange: string;
      dataPoints: number;
    };
  }> {
    const metrics = await this.dashboardService.getDashboardMetrics();
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const filteredPerformance = metrics.performance.filter(
      p => p.timestamp >= cutoffTime,
    );

    return {
      success: true,
      data: filteredPerformance,
      metadata: {
        timeRange: `${hours}h`,
        dataPoints: filteredPerformance.length,
      },
    };
  }

  @Get('alerts')
  @Roles('admin', 'moderator')
  @ApiOperationEnhanced({
    summary: 'Get System Alerts',
    description:
      'Get system alerts including errors, warnings, and informational messages with acknowledgment status.',
    tags: ['Dashboard', 'Alerts'],
  })
  @ApiQueryEnhanced({
    name: 'type',
    description: 'Filter alerts by type',
    required: false,
    enum: ['error', 'warning', 'info'],
  })
  @ApiQueryEnhanced({
    name: 'acknowledged',
    description: 'Filter by acknowledgment status',
    required: false,
    type: 'boolean',
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'System alerts retrieved successfully',
  })
  async getAlerts(
    @Query('type') type?: 'error' | 'warning' | 'info',
    @Query('acknowledged') acknowledged?: boolean,
  ): Promise<{
    success: boolean;
    data: DashboardAlert[];
    metadata: {
      total: number;
      unacknowledged: number;
    };
  }> {
    let alerts = this.dashboardService.getAlerts();

    // Apply filters
    if (type) {
      alerts = alerts.filter(alert => alert.type === type);
    }

    if (acknowledged !== undefined) {
      alerts = alerts.filter(alert => alert.acknowledged === acknowledged);
    }

    const unacknowledged = alerts.filter(alert => !alert.acknowledged).length;

    return {
      success: true,
      data: alerts,
      metadata: {
        total: alerts.length,
        unacknowledged,
      },
    };
  }

  @Patch('alerts/:alertId/acknowledge')
  @Roles('admin', 'moderator')
  @ApiOperationEnhanced({
    summary: 'Acknowledge Alert',
    description: 'Mark a specific alert as acknowledged.',
    tags: ['Dashboard', 'Alerts'],
  })
  @ApiParamEnhanced({
    name: 'alertId',
    description: 'ID of the alert to acknowledge',
    example: 'alert_1640995200000_abc123',
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Alert acknowledged successfully',
  })
  @ApiResponseEnhanced({
    status: 404,
    description: 'Alert not found',
  })
  async acknowledgeAlert(@Param('alertId') alertId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const acknowledged = this.dashboardService.acknowledgeAlert(alertId);

    if (!acknowledged) {
      return {
        success: false,
        message: 'Alert not found',
      };
    }

    this.logger.log(`Alert acknowledged: ${alertId}`);

    return {
      success: true,
      message: 'Alert acknowledged successfully',
    };
  }

  @Get('health')
  @Roles('admin', 'moderator', 'user')
  @ApiOperationEnhanced({
    summary: 'Get System Health Status',
    description:
      'Get overall system health status including individual health checks for memory, CPU, error rates, and response times.',
    tags: ['Dashboard', 'Health'],
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'System health status retrieved successfully',
  })
  async getHealthStatus(): Promise<{
    success: boolean;
    data: {
      status: 'healthy' | 'warning' | 'critical';
      checks: Array<{
        name: string;
        status: 'pass' | 'fail';
        message?: string;
      }>;
    };
    timestamp: Date;
  }> {
    const healthStatus = this.dashboardService.getHealthStatus();

    return {
      success: true,
      data: healthStatus,
      timestamp: new Date(),
    };
  }

  @Get('export')
  @Roles('admin')
  @ApiOperationEnhanced({
    summary: 'Export Dashboard Data',
    description:
      'Export dashboard metrics and data for external analysis or reporting.',
    tags: ['Dashboard', 'Export'],
  })
  @ApiQueryEnhanced({
    name: 'format',
    description: 'Export format',
    required: false,
    enum: ['json', 'csv'],
    example: 'json',
  })
  @ApiQueryEnhanced({
    name: 'timeRange',
    description: 'Time range for exported data',
    required: false,
    enum: ['1h', '24h', '7d', '30d'],
    example: '24h',
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Dashboard data exported successfully',
  })
  async exportDashboardData(
    @Query('format') format = 'json',
    @Query('timeRange') timeRange = '24h',
  ): Promise<{
    success: boolean;
    data: any;
    metadata: {
      format: string;
      timeRange: string;
      exportedAt: Date;
      recordCount: number;
    };
  }> {
    const metrics = await this.dashboardService.getDashboardMetrics();

    // For CSV format, we would flatten the data structure
    const exportData =
      format === 'csv' ? this.flattenMetricsForCsv(metrics) : metrics;

    return {
      success: true,
      data: exportData,
      metadata: {
        format,
        timeRange,
        exportedAt: new Date(),
        recordCount: this.countRecords(metrics),
      },
    };
  }

  /**
   * Helper method to flatten metrics for CSV export
   */
  private flattenMetricsForCsv(metrics: DashboardMetrics): any[] {
    const flattened = [];

    // Flatten endpoints data
    metrics.endpoints.forEach(endpoint => {
      flattened.push({
        type: 'endpoint',
        path: endpoint.path,
        method: endpoint.method,
        requests: endpoint.requests,
        averageResponseTime: endpoint.averageResponseTime,
        errorCount: endpoint.errorCount,
        successRate: endpoint.successRate,
      });
    });

    // Flatten performance data
    metrics.performance.forEach(perf => {
      flattened.push({
        type: 'performance',
        timestamp: perf.timestamp,
        responseTime: perf.responseTime,
        memoryUsage: perf.memoryUsage,
        cpuUsage: perf.cpuUsage,
      });
    });

    return flattened;
  }

  /**
   * Helper method to count total records in metrics
   */
  private countRecords(metrics: DashboardMetrics): number {
    return (
      metrics.endpoints.length +
      metrics.versions.length +
      metrics.errors.length +
      metrics.performance.length
    );
  }
}
