import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Request, Response } from 'express';
import { ApiGatewayService } from './services/api-gateway.service';
import { VersioningService } from './services/versioning.service';
import { ApiVersionGuard } from './guards/api-version.guard';
import { AdvancedRateLimitGuard } from './guards/advanced-rate-limit.guard';
import { ResponseTransformInterceptor } from './interceptors/response-transform.interceptor';
import { ApiAnalyticsInterceptor } from './interceptors/api-analytics.interceptor';
import { SecurityHeadersInterceptor } from './interceptors/security-headers.interceptor';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { apiGatewayConfig } from './config/api-gateway.config';

describe('API Gateway', () => {
  let gatewayService: ApiGatewayService;
  let versioningService: VersioningService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [apiGatewayConfig],
        }),
      ],
      providers: [
        ApiGatewayService,
        VersioningService,
        ApiVersionGuard,
        AdvancedRateLimitGuard,
        ResponseTransformInterceptor,
        ApiAnalyticsInterceptor,
        SecurityHeadersInterceptor,
        Reflector,
      ],
    }).compile();

    gatewayService = module.get<ApiGatewayService>(ApiGatewayService);
    versioningService = module.get<VersioningService>(VersioningService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('ApiGatewayService', () => {
    it('should be defined', () => {
      expect(gatewayService).toBeDefined();
    });

    it('should initialize with default routes', () => {
      const routes = gatewayService.getRoutes();
      expect(routes).toBeDefined();
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should register a new route', () => {
      const initialCount = gatewayService.getRoutes().length;

      gatewayService.registerRoute({
        path: '/test',
        method: 'GET',
        version: 'v1',
        analytics: true,
      });

      const routes = gatewayService.getRoutes();
      expect(routes.length).toBe(initialCount + 1);

      const testRoute = gatewayService.getRouteConfig('GET', '/test', 'v1');
      expect(testRoute).toBeDefined();
      expect(testRoute?.analytics).toBe(true);
    });

    it('should return gateway metrics', () => {
      const metrics = gatewayService.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('activeRequests');
      expect(metrics).toHaveProperty('averageResponseTime');
    });

    it('should process request with gateway headers', async () => {
      const mockReq = {
        method: 'GET',
        path: '/test',
        headers: {},
      } as Request;

      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn(),
      } as unknown as Response;

      const mockNext = jest.fn();

      await gatewayService.processRequest(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-API-Gateway',
        'FundShield-Gateway/1.0',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-API-Version',
        expect.any(String),
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('VersioningService', () => {
    it('should be defined', () => {
      expect(versioningService).toBeDefined();
    });

    it('should extract version from URI', () => {
      const mockReq = {
        path: '/api/v2/users',
        query: {},
        headers: {},
      } as Partial<Request> as Request;

      const versionInfo = versioningService.extractVersion(mockReq);
      expect(versionInfo.version).toBe('v2');
      expect(versionInfo.isSupported).toBe(true);
    });

    it('should extract version from header', () => {
      const mockReq = {
        path: '/api/users',
        query: {},
        headers: { 'x-api-version': 'v1' },
      } as Partial<Request> as Request;

      const versionInfo = versioningService.extractVersion(mockReq);
      expect(versionInfo.version).toBe('v1');
    });

    it('should return default version for invalid version', () => {
      const mockReq = {
        path: '/api/users',
        query: {},
        headers: { 'x-api-version': 'invalid' },
      } as Partial<Request> as Request;

      const versionInfo = versioningService.extractVersion(mockReq);
      expect(versionInfo.version).toBe('v1'); // Default version
    });

    it('should validate supported versions', () => {
      expect(() => versioningService.validateVersion('v1')).not.toThrow();
      expect(() => versioningService.validateVersion('v2')).not.toThrow();
      expect(() => versioningService.validateVersion('v99')).toThrow();
    });

    it('should transform data between versions', () => {
      const v1Data = {
        user_id: '123',
        created_at: '2024-01-01T00:00:00Z',
      };

      const v2Data = versioningService.transformResponseForVersion(
        v1Data,
        'v2',
      );
      expect(v2Data).toHaveProperty('userId', '123');
      expect(v2Data).toHaveProperty('createdAt', '2024-01-01T00:00:00Z');
    });

    it('should get version metadata', () => {
      const meta = versioningService.getVersionMeta();
      expect(meta).toHaveProperty('current');
      expect(meta).toHaveProperty('supported');
      expect(meta).toHaveProperty('deprecated');
      expect(meta).toHaveProperty('latest');
      expect(Array.isArray(meta.supported)).toBe(true);
    });
  });

  describe('ApiVersionGuard', () => {
    let guard: ApiVersionGuard;
    let reflector: Reflector;

    beforeEach(() => {
      guard = module.get<ApiVersionGuard>(ApiVersionGuard);
      reflector = module.get<Reflector>(Reflector);
    });

    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should allow version-neutral endpoints', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ path: '/health', headers: {} }),
          getResponse: () => ({ setHeader: jest.fn() }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should validate API version for versioned endpoints', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            path: '/api/v1/users',
            headers: { 'x-api-version': 'v1' },
          }),
          getResponse: () => ({ setHeader: jest.fn() }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });

  describe('AdvancedRateLimitGuard', () => {
    let guard: AdvancedRateLimitGuard;

    beforeEach(() => {
      guard = module.get<AdvancedRateLimitGuard>(AdvancedRateLimitGuard);
    });

    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should allow requests within rate limits', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            path: '/api/test',
            method: 'GET',
            headers: {},
            connection: { remoteAddress: '127.0.0.1' },
          }),
          getResponse: () => ({ setHeader: jest.fn() }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext;

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should get rate limit statistics', () => {
      const stats = guard.getStatistics();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalKeys');
      expect(stats).toHaveProperty('activeKeys');
      expect(stats).toHaveProperty('rules');
    });
  });

  describe('ResponseTransformInterceptor', () => {
    let interceptor: ResponseTransformInterceptor;

    beforeEach(() => {
      interceptor = module.get<ResponseTransformInterceptor>(
        ResponseTransformInterceptor,
      );
    });

    it('should be defined', () => {
      expect(interceptor).toBeDefined();
    });

    // Note: Testing interceptors requires more complex setup with RxJS observables
    // This is a basic structure test
  });

  describe('Integration Tests', () => {
    it('should handle complete request flow', async () => {
      // Simulate a complete request flow through the gateway
      const mockReq = {
        method: 'GET',
        path: '/api/v1/users',
        headers: { 'x-api-version': 'v1' },
        query: {},
        connection: { remoteAddress: '127.0.0.1' } as any,
      } as Partial<Request> as Request;

      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn(),
      } as unknown as Response;

      const mockNext = jest.fn();

      // Test gateway processingg
      await gatewayService.processRequest(mockReq, mockRes, mockNext);

      // Verify headers were set
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-API-Gateway',
        'FundShield-Gateway/1.0',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-API-Version', 'v1');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Request-ID',
        expect.any(String),
      );

      // Verify request was processedd
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq['apiVersion']).toBe('v1');
    });

    it('should track metrics across multiple requests', async () => {
      const initialMetrics = gatewayService.getMetrics();
      const initialTotal = initialMetrics.totalRequests;

      // Simulate multiple requestss
      for (let i = 0; i < 5; i++) {
        const mockReq = {
          method: 'GET',
          path: `/api/v1/test${i}`,
          headers: {},
        } as Request;

        const mockRes = {
          setHeader: jest.fn(),
          getHeader: jest.fn(),
        } as unknown as Response;

        const mockNext = jest.fn();

        await gatewayService.processRequest(mockReq, mockRes, mockNext);
      }

      const finalMetrics = gatewayService.getMetrics();
      expect(finalMetrics.totalRequests).toBe(initialTotal + 5);
    });
  });
});
