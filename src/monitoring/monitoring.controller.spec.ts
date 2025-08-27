import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringController } from './monitoring.controller';
import { PerformanceMetricsService, Alert, RequestMetrics } from './performance-metrics.service';

describe('MonitoringController', () => {
  let controller: MonitoringController;
  let metricsService: PerformanceMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MonitoringController],
      providers: [PerformanceMetricsService],
    }).compile();

    controller = module.get<MonitoringController>(MonitoringController);
    metricsService = module.get<PerformanceMetricsService>(PerformanceMetricsService);
  });

  it('should return stats', () => {
    metricsService.recordRequest({
      route: '/test',
      durationMs: 100,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    });
    const stats = controller.getMetrics('/test');
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.avg).toBeGreaterThan(0);
  });

  it('should return recent requests', () => {
    metricsService.recordRequest({
      route: '/recent',
      durationMs: 50,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    });
    const reqs = controller.getRecentRequests(1, '/recent');
    expect(reqs.length).toBe(1);
    expect(reqs[0].route).toBe('/recent');
  });

  it('should return alerts for slow requests', () => {
    metricsService.recordRequest({
      route: '/slow',
      durationMs: 2000,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    });
    const alerts = controller.getAlerts(1);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].type).toBe('slow-request');
  });

  it('should return cache stats', () => {
    metricsService.recordCacheHit();
    metricsService.recordCacheMiss();
    const stats = controller.getCacheStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(0.5);
  });
});
