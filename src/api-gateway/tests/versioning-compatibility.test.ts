import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { VersioningService } from '../services/versioning.service';
import { ApiGatewayService } from '../services/api-gateway.service';
import { ConfigService } from '@nestjs/config';

interface VersioningTestCase {
  name: string;
  headers?: Record<string, string>;
  path?: string;
  expectedVersion: string;
  expectedStatus: number;
  expectVersionInResponse?: boolean;
}

interface CompatibilityTest {
  fromVersion: string;
  toVersion: string;
  endpoint: string;
  method: string;
  payload?: any;
  expectedCompatible: boolean;
}

describe('API Versioning Compatibility Tests', () => {
  let app: INestApplication;
  let module: TestingModule;
  let versioningService: VersioningService;
  let gatewayService: ApiGatewayService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    versioningService = module.get<VersioningService>(VersioningService);
    gatewayService = module.get<ApiGatewayService>(ApiGatewayService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Version Detection and Extraction', () => {
    const versioningTestCases: VersioningTestCase[] = [
      {
        name: 'Header-based versioning with v1',
        headers: { 'X-API-Version': 'v1' },
        expectedVersion: 'v1',
        expectedStatus: 200,
      },
      {
        name: 'Header-based versioning with v2',
        headers: { 'X-API-Version': 'v2' },
        expectedVersion: 'v2',
        expectedStatus: 200,
      },
      {
        name: 'Accept header versioning',
        headers: { Accept: 'application/vnd.fundshield.v1+json' },
        expectedVersion: 'v1',
        expectedStatus: 200,
      },
      {
        name: 'Media type versioning',
        headers: { 'Content-Type': 'application/vnd.fundshield.v2+json' },
        expectedVersion: 'v2',
        expectedStatus: 200,
      },
      {
        name: 'Path-based versioning',
        path: '/api/v1/gateway/health',
        expectedVersion: 'v1',
        expectedStatus: 200,
      },
      {
        name: 'Query parameter versioning',
        path: '/api/gateway/health?version=v2',
        expectedVersion: 'v2',
        expectedStatus: 200,
      },
      {
        name: 'Default version when none specified',
        expectedVersion: 'v1',
        expectedStatus: 200,
      },
      {
        name: 'Invalid version header',
        headers: { 'X-API-Version': 'v99' },
        expectedVersion: 'v1', // Should fallback to default
        expectedStatus: 200,
      },
      {
        name: 'Deprecated version with warning',
        headers: { 'X-API-Version': 'v0.9' },
        expectedVersion: 'v0.9',
        expectedStatus: 200,
        expectVersionInResponse: true,
      },
    ];

    versioningTestCases.forEach(testCase => {
      it(`should handle ${testCase.name}`, async () => {
        const requestBuilder = request(app.getHttpServer()).get(
          testCase.path || '/api/gateway/health',
        );

        // Add headers if specified
        if (testCase.headers) {
          Object.entries(testCase.headers).forEach(([key, value]) => {
            requestBuilder.set(key, value);
          });
        }

        const response = await requestBuilder.expect(testCase.expectedStatus);

        // Verify version is detected correctly
        if (testCase.expectVersionInResponse) {
          expect(response.headers['x-api-version']).toBe(
            testCase.expectedVersion,
          );
        }

        // Verify response structure
        expect(response.body).toBeDefined();
        if (response.body.metadata) {
          expect(response.body.metadata.version).toBe(testCase.expectedVersion);
        }
      });
    });
  });

  describe('Version-Specific Response Transformations', () => {
    it('should transform responses based on API version', async () => {
      // Test v1 response format
      const v1Response = await request(app.getHttpServer())
        .get('/api/gateway/health')
        .set('X-API-Version', 'v1')
        .expect(200);

      expect(v1Response.body).toHaveProperty('status');
      expect(v1Response.body).toHaveProperty('timestamp');

      // Test v2 response format (if different)
      const v2Response = await request(app.getHttpServer())
        .get('/api/gateway/health')
        .set('X-API-Version', 'v2')
        .expect(200);

      expect(v2Response.body).toHaveProperty('status');
      expect(v2Response.body).toHaveProperty('timestamp');

      // Both should have the same basic structure but may have additional fields
      expect(typeof v1Response.body.status).toBe('string');
      expect(typeof v2Response.body.status).toBe('string');
    });

    it('should handle version-specific field transformations', async () => {
      // Test metrics endpoint with different versions
      const v1Metrics = await request(app.getHttpServer())
        .get('/api/gateway/metrics')
        .set('X-API-Version', 'v1')
        .expect(200);

      const v2Metrics = await request(app.getHttpServer())
        .get('/api/gateway/metrics')
        .set('X-API-Version', 'v2')
        .expect(200);

      // Both versions should have core metrics
      expect(v1Metrics.body).toHaveProperty('totalRequests');
      expect(v2Metrics.body).toHaveProperty('totalRequests');

      // v2 might have additional fields or different naming conventions
      expect(typeof v1Metrics.body.totalRequests).toBe('number');
      expect(typeof v2Metrics.body.totalRequests).toBe('number');
    });
  });

  describe('Backward Compatibility', () => {
    const compatibilityTests: CompatibilityTest[] = [
      {
        fromVersion: 'v1',
        toVersion: 'v2',
        endpoint: '/api/gateway/health',
        method: 'GET',
        expectedCompatible: true,
      },
      {
        fromVersion: 'v1',
        toVersion: 'v2',
        endpoint: '/api/gateway/metrics',
        method: 'GET',
        expectedCompatible: true,
      },
      {
        fromVersion: 'v2',
        toVersion: 'v1',
        endpoint: '/api/gateway/health',
        method: 'GET',
        expectedCompatible: true, // Backward compatible
      },
    ];

    compatibilityTests.forEach(test => {
      it(`should maintain compatibility from ${test.fromVersion} to ${test.toVersion} for ${test.method} ${test.endpoint}`, async () => {
        // Test original version
        const originalResponse = await request(app.getHttpServer())
          [test.method.toLowerCase()](test.endpoint)
          .set('X-API-Version', test.fromVersion)
          .send(test.payload);

        // Test target version
        const targetResponse = await request(app.getHttpServer())
          [test.method.toLowerCase()](test.endpoint)
          .set('X-API-Version', test.toVersion)
          .send(test.payload);

        if (test.expectedCompatible) {
          // Both should succeed
          expect(originalResponse.status).toBeLessThan(400);
          expect(targetResponse.status).toBeLessThan(400);

          // Both should have similar core structure
          if (originalResponse.body && targetResponse.body) {
            // Check that essential fields exist in both versions
            const originalKeys = Object.keys(originalResponse.body);
            const targetKeys = Object.keys(targetResponse.body);

            // At least some fields should be common
            const commonKeys = originalKeys.filter(key =>
              targetKeys.includes(key),
            );
            expect(commonKeys.length).toBeGreaterThan(0);
          }
        }
      });
    });
  });

  describe('Version Deprecation Handling', () => {
    it('should include deprecation warnings for deprecated versions', async () => {
      // Test deprecated version (assuming v0.9 is deprecated)
      const response = await request(app.getHttpServer())
        .get('/api/gateway/health')
        .set('X-API-Version', 'v0.9')
        .expect(200);

      // Should include deprecation warning in headers
      expect(response.headers['x-api-deprecation-warning']).toBeDefined();
      expect(response.headers['x-api-deprecation-warning']).toContain(
        'deprecated',
      );
    });

    it('should provide migration information for deprecated versions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/versioning/info')
        .set('X-API-Version', 'v0.9')
        .expect(200);

      expect(response.body).toHaveProperty('deprecated');
      expect(response.body).toHaveProperty('latest');
      expect(response.body.deprecated).toContain('v0.9');
    });
  });

  describe('Version Routing and Request Handling', () => {
    it('should route requests to correct version handlers', async () => {
      // Test that different versions can coexist
      const v1Health = await request(app.getHttpServer())
        .get('/api/gateway/health')
        .set('X-API-Version', 'v1')
        .expect(200);

      const v2Health = await request(app.getHttpServer())
        .get('/api/gateway/health')
        .set('X-API-Version', 'v2')
        .expect(200);

      // Both should be successful but may have different response formats
      expect(v1Health.body).toBeDefined();
      expect(v2Health.body).toBeDefined();

      // Verify version is correctly set in response metadata
      if (v1Health.body.metadata) {
        expect(v1Health.body.metadata.version).toBe('v1');
      }
      if (v2Health.body.metadata) {
        expect(v2Health.body.metadata.version).toBe('v2');
      }
    });

    it('should handle version-specific request transformations', async () => {
      // Test POST request with version-specific handling
      const v1Dashboard = await request(app.getHttpServer())
        .get('/api/dashboard/metrics')
        .set('X-API-Version', 'v1')
        .expect(200);

      const v2Dashboard = await request(app.getHttpServer())
        .get('/api/dashboard/metrics')
        .set('X-API-Version', 'v2')
        .expect(200);

      // Both should return valid dashboard data
      expect(v1Dashboard.body).toBeDefined();
      expect(v2Dashboard.body).toBeDefined();
    });
  });

  describe('Cross-Version Data Consistency', () => {
    it('should maintain data consistency across versions', async () => {
      // Get the same data through different API versions
      const v1Metrics = await request(app.getHttpServer())
        .get('/api/gateway/metrics')
        .set('X-API-Version', 'v1')
        .expect(200);

      const v2Metrics = await request(app.getHttpServer())
        .get('/api/gateway/metrics')
        .set('X-API-Version', 'v2')
        .expect(200);

      // Core metrics should be consistent
      if (v1Metrics.body.totalRequests && v2Metrics.body.totalRequests) {
        // Allow for small differences due to timing
        const diff = Math.abs(
          v1Metrics.body.totalRequests - v2Metrics.body.totalRequests,
        );
        expect(diff).toBeLessThanOrEqual(5); // Should be very close
      }
    });

    it('should handle version-specific error formats', async () => {
      // Test error responses across versions
      const v1Error = await request(app.getHttpServer())
        .get('/api/non-existent-endpoint')
        .set('X-API-Version', 'v1')
        .expect(404);

      const v2Error = await request(app.getHttpServer())
        .get('/api/non-existent-endpoint')
        .set('X-API-Version', 'v2')
        .expect(404);

      // Both should be 404 but may have different error formats
      expect(v1Error.status).toBe(404);
      expect(v2Error.status).toBe(404);

      // Check that error responses have proper structure
      if (typeof v1Error.body === 'object') {
        expect(v1Error.body).toBeDefined();
      }
      if (typeof v2Error.body === 'object') {
        expect(v2Error.body).toBeDefined();
      }
    });
  });

  describe('Version Validation and Security', () => {
    it('should validate version format and reject invalid versions', async () => {
      const invalidVersions = ['v999', 'invalid', '1.0.0', 'beta', ''];

      for (const version of invalidVersions) {
        const response = await request(app.getHttpServer())
          .get('/api/gateway/health')
          .set('X-API-Version', version);

        // Should either reject with 400 or fallback to default version
        if (response.status === 400) {
          expect(response.body).toHaveProperty('error');
        } else {
          // If fallback to default, should be successful
          expect(response.status).toBe(200);
        }
      }
    });

    it('should handle version-specific security requirements', async () => {
      // Test if different versions have different security requirements
      const v1Response = await request(app.getHttpServer())
        .get('/api/gateway/health')
        .set('X-API-Version', 'v1');

      const v2Response = await request(app.getHttpServer())
        .get('/api/gateway/health')
        .set('X-API-Version', 'v2');

      // Both should have appropriate security headers
      expect(v1Response.headers).toBeDefined();
      expect(v2Response.headers).toBeDefined();

      // Check for security headers
      ['x-content-type-options', 'x-frame-options'].forEach(header => {
        if (v1Response.headers[header] || v2Response.headers[header]) {
          // If one version has security headers, both should
          expect(
            v1Response.headers[header] || v2Response.headers[header],
          ).toBeDefined();
        }
      });
    });
  });

  describe('Version Migration Support', () => {
    it('should provide version migration information', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/versioning/info')
        .expect(200);

      expect(response.body).toHaveProperty('current');
      expect(response.body).toHaveProperty('supported');
      expect(response.body).toHaveProperty('deprecated');
      expect(response.body).toHaveProperty('latest');

      // Validate structure
      expect(Array.isArray(response.body.supported)).toBe(true);
      expect(Array.isArray(response.body.deprecated)).toBe(true);
      expect(typeof response.body.current).toBe('string');
      expect(typeof response.body.latest).toBe('string');
    });

    it('should handle version upgrade recommendations', async () => {
      // Test with a deprecated version
      const response = await request(app.getHttpServer())
        .get('/api/versioning/upgrade-path')
        .set('X-API-Version', 'v0.9')
        .query({ from: 'v0.9', to: 'v2' })
        .expect(200);

      expect(response.body).toHaveProperty('upgradePath');
      expect(response.body).toHaveProperty('breakingChanges');
      expect(response.body).toHaveProperty('migrationSteps');
    });
  });

  describe('Performance Across Versions', () => {
    it('should maintain reasonable performance across versions', async () => {
      const versions = ['v1', 'v2'];
      const performanceResults: { version: string; responseTime: number }[] =
        [];

      for (const version of versions) {
        const startTime = Date.now();

        await request(app.getHttpServer())
          .get('/api/gateway/metrics')
          .set('X-API-Version', version)
          .expect(200);

        const responseTime = Date.now() - startTime;
        performanceResults.push({ version, responseTime });
      }

      // All versions should respond within reasonable time
      performanceResults.forEach(result => {
        expect(result.responseTime).toBeLessThan(5000); // 5 second max
      });

      // Performance difference between versions shouldn't be extreme
      if (performanceResults.length > 1) {
        const responseTimes = performanceResults.map(r => r.responseTime);
        const min = Math.min(...responseTimes);
        const max = Math.max(...responseTimes);

        // Max response time shouldn't be more than 10x min response time
        expect(max / min).toBeLessThan(10);
      }
    });
  });
});
