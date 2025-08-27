  afterEach(() => {
    metricsService.clearAlerts();
    metricsService.clearRequests();
  });
  it('should filter stats by route', () => {
    metricsService.recordRequest({
      route: '/foo',
      durationMs: 10,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    });
    metricsService.recordRequest({
      route: '/bar',
      durationMs: 20,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    });
    const statsFoo = controller.getMetrics('/foo');
    const statsBar = controller.getMetrics('/bar');
    expect(statsFoo.total).toBe(1);
    expect(statsBar.total).toBe(1);
  });

  it('should return high-memory alert', () => {
    const fakeMem = { ...process.memoryUsage(), heapUsed: 900 * 1024 * 1024, heapTotal: 1000 * 1024 * 1024 };
    metricsService.recordRequest({
      route: '/mem',
      durationMs: 10,
      memoryUsage: fakeMem,
      cpuUsage: process.cpuUsage(),
    });
    const alerts = controller.getAlerts(1);
    expect(alerts.some(a => a.type === 'high-memory')).toBe(true);
  });

  it('should return high-cpu alert', () => {
    const fakeCpu = { ...process.cpuUsage(), user: 2e6, system: 0 };
    metricsService.recordRequest({
      route: '/cpu',
      durationMs: 10,
      memoryUsage: process.memoryUsage(),
      cpuUsage: fakeCpu,
    });
    const alerts = controller.getAlerts(1);
    expect(alerts.some(a => a.type === 'high-cpu')).toBe(true);
  });

  it('should clear alerts', () => {
    metricsService.recordRequest({
      route: '/slow',
      durationMs: 2000,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    });
    metricsService.clearAlerts();
    expect(controller.getAlerts().length).toBe(0);
  });
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
