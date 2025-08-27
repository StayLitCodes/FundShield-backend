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
