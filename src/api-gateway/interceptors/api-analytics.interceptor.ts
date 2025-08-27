import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiGatewayConfig } from '../config/api-gateway.config';
import { throwError } from 'rxjs';

interface ApiMetric {
  id: string;
  timestamp: Date;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  ip?: string;
  userId?: string;
  apiVersion?: string;
  error?: string;
  requestSize?: number;
  responseSize?: number;
}

@Injectable()
export class ApiAnalyticsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiAnalyticsInterceptor.name);
  private readonly config: ApiGatewayConfig;
  private readonly metrics: ApiMetric[] = [];
  private readonly maxMetrics = 10000; // Keep last 10k metrics in memory

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<ApiGatewayConfig>('apiGateway');
    this.startMetricsFlush();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.config.analytics.enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Skip excluded paths
    if (this.shouldSkipTracking(request.path)) {
      return next.handle();
    }

    // Apply sampling
    if (Math.random() > this.config.analytics.sampling) {
      return next.handle();
    }

    const requestId = this.generateRequestId();
    request['requestId'] = requestId;

    return next.handle().pipe(
      tap(() => {
        this.trackMetric(request, response, startTime, requestId);
      }),
      catchError(error => {
        this.trackMetric(request, response, startTime, requestId, error);
        return throwError(error);
      }),
    );
  }

  /**
   * Track API metric
   */
  private trackMetric(
    request: Request,
    response: Response,
    startTime: number,
    requestId: string,
    error?: any,
  ): void {
    const metric: ApiMetric = {
      id: requestId,
      timestamp: new Date(),
      method: request.method,
      path: this.sanitizePath(request.path),
      statusCode: response.statusCode || (error ? 500 : 200),
      responseTime: Date.now() - startTime,
      apiVersion: request['apiVersion'] || 'unknown',
    };

    // Add optional tracking data
    if (this.config.analytics.trackUserAgent) {
      metric.userAgent = request.headers['user-agent'];
    }

    if (this.config.analytics.trackIP) {
      metric.ip = this.getClientIP(request);
    }

    if (this.config.analytics.trackHeaders && (request as any)['user']) {
      metric.userId = (request as any)['user'].id;
    }

    if (error) {
      metric.error = error.message || 'Unknown error';
    }

    // Track request/response sizes if available
    if (request.headers['content-length']) {
      metric.requestSize = parseInt(request.headers['content-length'], 10);
    }

    const responseLength = response.getHeader('content-length');
    if (responseLength) {
      metric.responseSize = parseInt(responseLength.toString(), 10);
    }

    this.addMetric(metric);
  }

  /**
   * Add metric to collection
   */
  private addMetric(metric: ApiMetric): void {
    this.metrics.push(metric);

    // Keep only recent metrics in memory
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.splice(0, this.metrics.length - this.maxMetrics);
    }

    this.logger.debug(
      `Tracked API metric: ${metric.method} ${metric.path} (${metric.responseTime}ms)`,
    );
  }

  /**
   * Check if path should be skipped
   */
  private shouldSkipTracking(path: string): boolean {
    return this.config.analytics.exclusions.some(pattern =>
      path.includes(pattern),
    );
  }

  /**
   * Sanitize path to remove sensitive information
   */
  private sanitizePath(path: string): string {
    // Remove UUIDs and other sensitive patterns
    return path
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id',
      )
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9]{24}/g, '/:id'); // MongoDB ObjectIds
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: Request): string {
    return (
      (request.headers['cf-connecting-ip'] as string) ||
      (request.headers['x-forwarded-for'] as string) ||
      (request.headers['x-real-ip'] as string) ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start periodic metrics flush
   */
  private startMetricsFlush(): void {
    setInterval(() => {
      this.flushMetrics();
    }, 60000); // Flush every minute
  }

  /**
   * Flush metrics to persistent storage or external service
   */
  private flushMetrics(): void {
    if (this.metrics.length === 0) {
      return;
    }

    // In a real implementation, this would send metrics to:
    // - Database
    // - Analytics service (e.g., Google Analytics, Mixpanel)
    // - Time series database (e.g., InfluxDB, Prometheus)
    // - Log aggregation service (e.g., ELK stack)

    const metricsToFlush = [...this.metrics];
    this.logger.log(
      `Flushing ${metricsToFlush.length} metrics to analytics service`,
    );

    // For now, we'll just log a summary
    this.logMetricsSummary(metricsToFlush);
  }

  /**
   * Log metrics summary
   */
  private logMetricsSummary(metrics: ApiMetric[]): void {
    if (metrics.length === 0) return;

    const summary = {
      total: metrics.length,
      timeRange: {
        start: metrics[0].timestamp.toISOString(),
        end: metrics[metrics.length - 1].timestamp.toISOString(),
      },
      methods: this.groupBy(metrics, 'method'),
      statusCodes: this.groupBy(metrics, 'statusCode'),
      averageResponseTime:
        metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length,
      errors: metrics.filter(m => m.error).length,
      topPaths: this.getTopPaths(metrics),
    };

    this.logger.log(`Analytics Summary: ${JSON.stringify(summary, null, 2)}`);
  }

  /**
   * Group metrics by field
   */
  private groupBy(
    metrics: ApiMetric[],
    field: keyof ApiMetric,
  ): Record<string, number> {
    return metrics.reduce(
      (acc, metric) => {
        const key = String(metric[field]);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Get top paths by request count
   */
  private getTopPaths(
    metrics: ApiMetric[],
  ): Array<{ path: string; count: number }> {
    const pathCounts = this.groupBy(metrics, 'path');
    return Object.entries(pathCounts)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get current metrics
   */
  getMetrics(): ApiMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): any {
    const recentMetrics = this.metrics.filter(
      m => Date.now() - m.timestamp.getTime() < 3600000, // Last hour
    );

    return {
      total: this.metrics.length,
      lastHour: recentMetrics.length,
      averageResponseTime:
        recentMetrics.length > 0
          ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) /
            recentMetrics.length
          : 0,
      errorRate:
        recentMetrics.length > 0
          ? recentMetrics.filter(m => m.error).length / recentMetrics.length
          : 0,
      topPaths: this.getTopPaths(recentMetrics),
      methods: this.groupBy(recentMetrics, 'method'),
      statusCodes: this.groupBy(recentMetrics, 'statusCode'),
    };
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics.length = 0;
    this.logger.log('Cleared all metrics');
  }
}
