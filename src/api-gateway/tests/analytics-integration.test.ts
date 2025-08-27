import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  AnalyticsIntegrationService,
  AnalyticsSnapshot,
  AnalyticsTrend,
} from '../services/analytics-integration.service';
import { ApiAnalyticsInterceptor } from '../interceptors/api-analytics.interceptor';
import { AdvancedRateLimitGuard } from '../guards/advanced-rate-limit.guard';
import { DashboardService } from '../services/dashboard.service';
import { ApiGatewayService } from '../services/api-gateway.service';
import { VersioningService } from '../services/versioning.service';

describe('AnalyticsIntegrationService', () => {
  let service: AnalyticsIntegrationService;
  let module: TestingModule;
  let mockAnalyticsInterceptor: jest.Mocked<ApiAnalyticsInterceptor>;
  let mockRateLimitGuard: jest.Mocked<AdvancedRateLimitGuard>;
  let mockDashboardService: jest.Mocked<DashboardService>;
  let mockGatewayService: jest.Mocked<ApiGatewayService>;
  let mockVersioningService: jest.Mocked<VersioningService>;

  beforeAll(async () => {
    // Create mock services
    mockAnalyticsInterceptor = {
      getMetrics: jest.fn(),
      getMetricsSummary: jest.fn(),
      clearMetrics: jest.fn(),
    } as any;

    mockRateLimitGuard = {
      getStatistics: jest.fn(),
    } as any;

    mockDashboardService = {
      getDashboardMetrics: jest.fn(),
    } as any;

    mockGatewayService = {
      getMetrics: jest.fn(),
      resetMetrics: jest.fn(),
    } as any;

    mockVersioningService = {
      getVersionMeta: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        AnalyticsIntegrationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({}),
          },
        },
        {
          provide: ApiAnalyticsInterceptor,
          useValue: mockAnalyticsInterceptor,
        },
        {
          provide: AdvancedRateLimitGuard,
          useValue: mockRateLimitGuard,
        },
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
        {
          provide: ApiGatewayService,
          useValue: mockGatewayService,
        },
        {
          provide: VersioningService,
          useValue: mockVersioningService,
        },
      ],
    }).compile();

    service = module.get<AnalyticsIntegrationService>(
      AnalyticsIntegrationService,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock responses
    mockAnalyticsInterceptor.getMetrics.mockReturnValue([
      {
        id: 'req_1',
        timestamp: new Date(),
        method: 'GET',
        path: '/api/test',
        statusCode: 200,
        responseTime: 100,
        userId: 'user1',
        apiVersion: 'v1',
        ip: '192.168.1.1',
      },
      {
        id: 'req_2',
        timestamp: new Date(),
        method: 'POST',
        path: '/api/create',
        statusCode: 201,
        responseTime: 150,
        userId: 'user2',
        apiVersion: 'v1',
        ip: '192.168.1.2',
      },
      {
        id: 'req_3',
        timestamp: new Date(),
        method: 'GET',
        path: '/api/test',
        statusCode: 500,
        responseTime: 200,
        error: 'Internal Server Error',
        userId: 'user1',
        apiVersion: 'v2',
        ip: '192.168.1.1',
      },
    ] as any);

    mockAnalyticsInterceptor.getMetricsSummary.mockReturnValue({
      total: 3,
      lastHour: 3,
      averageResponseTime: 150,
      errorRate: 0.33,
      topPaths: [
        { path: '/api/test', count: 2 },
        { path: '/api/create', count: 1 },
      ],
      methods: { GET: 2, POST: 1 },
      statusCodes: { '200': 1, '201': 1, '500': 1 },
    });

    mockRateLimitGuard.getStatistics.mockReturnValue({
      totalKeys: 10,
      blockedRequests: 5,
      topKeys: [
        { key: 'ip:192.168.1.100', count: 15 },
        { key: 'user:user123', count: 10 },
        { key: 'apikey:key456', count: 8 },
      ],
    } as any);

    mockGatewayService.getMetrics.mockReturnValue({
      totalRequests: 1000,
      activeRequests: 5,
      averageResponseTime: 150,
      errorRate: 0.02,
      rateLimitHits: 25,
      lastUpdated: new Date().toISOString(),
    });

    mockVersioningService.getVersionMeta.mockReturnValue({
      current: 'v2',
      supported: ['v1', 'v2'],
      deprecated: ['v0.9'],
      latest: 'v2',
    });
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with proper dependencies', () => {
      expect(mockAnalyticsInterceptor).toBeDefined();
      expect(mockRateLimitGuard).toBeDefined();
      expect(mockDashboardService).toBeDefined();
      expect(mockGatewayService).toBeDefined();
      expect(mockVersioningService).toBeDefined();
    });
  });

  describe('Analytics Snapshot Generation', () => {
    it('should take a snapshot successfully', async () => {
      const snapshot = await service.takeSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.metrics).toBeDefined();
      expect(snapshot.metrics.totalRequests).toBe(3);
      expect(snapshot.metrics.uniqueUsers).toBe(2);
      expect(snapshot.metrics.averageResponseTime).toBe(150);
      expect(snapshot.metrics.errorRate).toBe(0.33);
    });

    it('should calculate unique users correctly', async () => {
      const snapshot = await service.takeSnapshot();

      // Should count unique users (user1, user2) = 2
      expect(snapshot.metrics.uniqueUsers).toBe(2);
    });

    it('should identify top endpoints', async () => {
      const snapshot = await service.takeSnapshot();

      expect(snapshot.metrics.topEndpoints).toBeDefined();
      expect(snapshot.metrics.topEndpoints.length).toBeGreaterThan(0);
      expect(snapshot.metrics.topEndpoints[0].path).toBe('/api/test');
      expect(snapshot.metrics.topEndpoints[0].requests).toBe(2);
    });

    it('should calculate version distribution', async () => {
      const snapshot = await service.takeSnapshot();

      expect(snapshot.metrics.versionDistribution).toBeDefined();
      expect(snapshot.metrics.versionDistribution.length).toBe(2);

      const v1Distribution = snapshot.metrics.versionDistribution.find(
        v => v.version === 'v1',
      );
      const v2Distribution = snapshot.metrics.versionDistribution.find(
        v => v.version === 'v2',
      );

      expect(v1Distribution).toBeDefined();
      expect(v1Distribution?.requestCount).toBe(2);
      expect(v1Distribution?.percentage).toBe(67); // 2/3 * 100 = 67%

      expect(v2Distribution).toBeDefined();
      expect(v2Distribution?.requestCount).toBe(1);
      expect(v2Distribution?.percentage).toBe(33); // 1/3 * 100 = 33%
    });

    it('should include rate limiting statistics', async () => {
      const snapshot = await service.takeSnapshot();

      expect(snapshot.metrics.rateLimitingStats).toBeDefined();
      expect(snapshot.metrics.rateLimitingStats.topOffenders).toBeDefined();
      expect(snapshot.metrics.rateLimitingStats.topOffenders.length).toBe(3);

      const ipOffender = snapshot.metrics.rateLimitingStats.topOffenders.find(
        o => o.type === 'ip',
      );
      expect(ipOffender).toBeDefined();
      expect(ipOffender?.identifier).toBe('ip:192.168.1.100');
    });

    it('should include performance metrics', async () => {
      const snapshot = await service.takeSnapshot();

      expect(snapshot.metrics.performanceMetrics).toBeDefined();
      expect(typeof snapshot.metrics.performanceMetrics.memoryUsage).toBe(
        'number',
      );
      expect(typeof snapshot.metrics.performanceMetrics.cpuUsage).toBe(
        'number',
      );
      expect(snapshot.metrics.performanceMetrics.activeConnections).toBe(5);
    });
  });

  describe('Analytics Trends', () => {
    beforeEach(async () => {
      // Create some historical snapshots
      for (let i = 0; i < 5; i++) {
        await service.takeSnapshot();
        // Simulate time passing
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });

    it('should calculate trends for multiple metrics', () => {
      const trends = service.getAnalyticsTrends(
        ['totalRequests', 'averageResponseTime'],
        '1h',
      );

      expect(trends).toBeDefined();
      expect(trends.length).toBe(2);

      const requestTrend = trends.find(t => t.metric === 'totalRequests');
      const responseTimeTrend = trends.find(
        t => t.metric === 'averageResponseTime',
      );

      expect(requestTrend).toBeDefined();
      expect(responseTimeTrend).toBeDefined();
    });

    it('should identify trend direction correctly', () => {
      const trends = service.getAnalyticsTrends(['totalRequests'], '1h');

      expect(trends.length).toBe(1);
      expect(trends[0].trend).toMatch(/up|down|stable/);
      expect(typeof trends[0].changePercentage).toBe('number');
    });

    it('should return empty array when insufficient data', () => {
      // Create a new service instance with no snapshots
      const emptyService = new AnalyticsIntegrationService(
        module.get(ConfigService),
        mockAnalyticsInterceptor,
        mockRateLimitGuard,
        mockDashboardService,
        mockGatewayService,
        mockVersioningService,
      );

      const trends = emptyService.getAnalyticsTrends(['totalRequests'], '1h');
      expect(trends).toEqual([]);
    });
  });

  describe('Analytics Reports', () => {
    beforeEach(async () => {
      // Create some snapshots for report generation
      for (let i = 0; i < 3; i++) {
        await service.takeSnapshot();
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });

    it('should generate comprehensive analytics report', async () => {
      const start = new Date(Date.now() - 3600000); // 1 hour ago
      const end = new Date();

      const report = await service.generateAnalyticsReport({ start, end });

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.period.start).toEqual(start);
      expect(report.period.end).toEqual(end);
      expect(report.summary).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.insights).toBeDefined();
      expect(report.rawData).toBeDefined();
    });

    it('should calculate report summary correctly', async () => {
      const start = new Date(Date.now() - 3600000);
      const end = new Date();

      const report = await service.generateAnalyticsReport({ start, end });

      expect(report.summary.totalRequests).toBeGreaterThan(0);
      expect(report.summary.uniqueUsers).toBeGreaterThan(0);
      expect(report.summary.averageResponseTime).toBeGreaterThan(0);
      expect(report.summary.errorRate).toBeGreaterThanOrEqual(0);
      expect(report.summary.uptime).toBeGreaterThanOrEqual(0);
      expect(report.summary.uptime).toBeLessThanOrEqual(100);
    });

    it('should generate actionable insights', async () => {
      const start = new Date(Date.now() - 3600000);
      const end = new Date();

      const report = await service.generateAnalyticsReport({ start, end });

      expect(Array.isArray(report.insights)).toBe(true);

      // Check insight structure if any exist
      if (report.insights.length > 0) {
        const insight = report.insights[0];
        expect(insight.type).toMatch(/warning|info|success/);
        expect(insight.title).toBeDefined();
        expect(insight.description).toBeDefined();
        expect(typeof insight.actionable).toBe('boolean');
      }
    });

    it('should throw error for invalid period', async () => {
      const start = new Date();
      const end = new Date(Date.now() - 3600000); // End before start

      await expect(
        service.generateAnalyticsReport({ start, end }),
      ).rejects.toThrow('No data available for the specified period');
    });
  });

  describe('Data Retrieval', () => {
    beforeEach(async () => {
      // Create some snapshots
      for (let i = 0; i < 3; i++) {
        await service.takeSnapshot();
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });

    it('should get current dashboard data', async () => {
      const data = await service.getCurrentDashboardData();

      expect(data).toBeDefined();
      expect(data.timestamp).toBeInstanceOf(Date);
      expect(data.metrics).toBeDefined();
    });

    it('should get analytics data for time range', () => {
      const start = new Date(Date.now() - 3600000);
      const end = new Date();

      const data = service.getAnalyticsData(start, end);

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(0);

      // All data should be within the specified range
      data.forEach(snapshot => {
        expect(snapshot.timestamp).toBeInstanceOf(Date);
        expect(snapshot.timestamp.getTime()).toBeGreaterThanOrEqual(
          start.getTime(),
        );
        expect(snapshot.timestamp.getTime()).toBeLessThanOrEqual(end.getTime());
      });
    });

    it('should apply data aggregation correctly', () => {
      const start = new Date(Date.now() - 3600000);
      const end = new Date();

      const hourlyData = service.getAnalyticsData(start, end, 'hour');
      const minuteData = service.getAnalyticsData(start, end, 'minute');

      expect(Array.isArray(hourlyData)).toBe(true);
      expect(Array.isArray(minuteData)).toBe(true);

      // Hourly aggregation should typically result in fewer data points
      // (though this might not always be true with test data)
      expect(hourlyData.length).toBeLessThanOrEqual(minuteData.length);
    });
  });

  describe('Error Handling', () => {
    it('should handle analytics interceptor errors gracefully', async () => {
      mockAnalyticsInterceptor.getMetrics.mockImplementation(() => {
        throw new Error('Analytics service unavailable');
      });

      await expect(service.takeSnapshot()).rejects.toThrow(
        'Failed to take analytics snapshot',
      );
    });

    it('should handle rate limit guard errors gracefully', async () => {
      mockRateLimitGuard.getStatistics.mockImplementation(() => {
        throw new Error('Rate limit service unavailable');
      });

      await expect(service.takeSnapshot()).rejects.toThrow(
        'Failed to take analytics snapshot',
      );
    });

    it('should handle missing data gracefully', () => {
      mockAnalyticsInterceptor.getMetrics.mockReturnValue([]);
      mockAnalyticsInterceptor.getMetricsSummary.mockReturnValue({
        total: 0,
        lastHour: 0,
        averageResponseTime: 0,
        errorRate: 0,
        topPaths: [],
        methods: {},
        statusCodes: {},
      });

      expect(async () => await service.takeSnapshot()).not.toThrow();
    });
  });

  describe('Data Validation', () => {
    it('should validate snapshot data structure', async () => {
      const snapshot = await service.takeSnapshot();

      // Validate required fields
      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(typeof snapshot.metrics.totalRequests).toBe('number');
      expect(typeof snapshot.metrics.uniqueUsers).toBe('number');
      expect(typeof snapshot.metrics.averageResponseTime).toBe('number');
      expect(typeof snapshot.metrics.errorRate).toBe('number');
      expect(Array.isArray(snapshot.metrics.topEndpoints)).toBe(true);
      expect(Array.isArray(snapshot.metrics.versionDistribution)).toBe(true);
      expect(typeof snapshot.metrics.rateLimitingStats).toBe('object');
      expect(typeof snapshot.metrics.performanceMetrics).toBe('object');
    });

    it('should validate trend data structure', () => {
      // Create some snapshots first
      service.takeSnapshot();
      service.takeSnapshot();

      const trends = service.getAnalyticsTrends(['totalRequests'], '1h');

      if (trends.length > 0) {
        const trend = trends[0];
        expect(typeof trend.metric).toBe('string');
        expect(trend.timeframe).toMatch(/1h|24h|7d|30d/);
        expect(Array.isArray(trend.data)).toBe(true);
        expect(trend.trend).toMatch(/up|down|stable/);
        expect(typeof trend.changePercentage).toBe('number');
      }
    });

    it('should validate numeric ranges', async () => {
      const snapshot = await service.takeSnapshot();

      // Error rate should be between 0 and 1
      expect(snapshot.metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(snapshot.metrics.errorRate).toBeLessThanOrEqual(1);

      // Response time should be positive
      expect(snapshot.metrics.averageResponseTime).toBeGreaterThanOrEqual(0);

      // Request count should be non-negative
      expect(snapshot.metrics.totalRequests).toBeGreaterThanOrEqual(0);

      // User count should be non-negative
      expect(snapshot.metrics.uniqueUsers).toBeGreaterThanOrEqual(0);

      // Performance metrics should be within valid ranges
      expect(
        snapshot.metrics.performanceMetrics.memoryUsage,
      ).toBeGreaterThanOrEqual(0);
      expect(
        snapshot.metrics.performanceMetrics.memoryUsage,
      ).toBeLessThanOrEqual(100);
      expect(
        snapshot.metrics.performanceMetrics.cpuUsage,
      ).toBeGreaterThanOrEqual(0);
      expect(snapshot.metrics.performanceMetrics.cpuUsage).toBeLessThanOrEqual(
        100,
      );
    });
  });
});
