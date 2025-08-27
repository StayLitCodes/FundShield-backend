import { Controller, Get, Query } from '@nestjs/common';
import { PerformanceMetricsService } from '../monitoring/performance-metrics.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly metricsService: PerformanceMetricsService) {}

  @Get('alerts')
  getAlerts(@Query('limit') limit?: number) {
    return this.metricsService.getAlerts(limit);
  }

  @Get('cache-stats')
  getCacheStats() {
    return this.metricsService.getCacheStats();
  }

  @Get('metrics')
  getMetrics(@Query('route') route?: string) {
    return this.metricsService.getStats(route);
  }

  @Get('recent-requests')
  getRecentRequests(@Query('limit') limit?: number, @Query('route') route?: string): any {
    return this.metricsService.getRecentRequests(limit, route);
  }
}
import { Controller, Get } from '@nestjs/common';
import { PerformanceMetricsService } from '../monitoring/performance-metrics.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly metricsService: PerformanceMetricsService) {}


  @Get('metrics')
  getMetrics(route?: string) {
    return this.metricsService.getStats(route);
  }


  @Get('recent-requests')
  getRecentRequests(limit?: number, route?: string): any {
    return this.metricsService.getRecentRequests(limit, route);
  }
}
