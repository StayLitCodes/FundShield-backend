import { Controller, Get } from '@nestjs/common';
import { PerformanceMetricsService } from '../monitoring/performance-metrics.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly metricsService: PerformanceMetricsService) {}

  @Get('metrics')
  getMetrics() {
    return this.metricsService.getStats();
  }

  @Get('recent-requests')
  getRecentRequests(): any {
    return this.metricsService.getRecentRequests();
  }
}
