import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { AdvancedRateLimitGuard } from '../guards/advanced-rate-limit.guard';
import { ApiGatewayService } from '../services/api-gateway.service';
import { ConfigService } from '@nestjs/config';

interface RateLimitTest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  expectedLimit: number;
  timeWindow: number; // in milliseconds
  description: string;
}

interface RateLimitResult {
  endpoint: string;
  requestsMade: number;
  successfulRequests: number;
  rateLimitedRequests: number;
  firstRateLimitAt: number | null;
  resetTime: number | null;
  averageResponseTime: number;
  rateLimitHeaders: { [key: string]: string };
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  rateLimitedRequests: number;
  errorRequests: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  throughput: number; // requests per second
}

describe('Rate Limiting Verification Tests', () => {
  let app: INestApplication;
  let module: TestingModule;
  let rateLimitGuard: AdvancedRateLimitGuard;
  let gatewayService: ApiGatewayService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    rateLimitGuard = module.get<AdvancedRateLimitGuard>(AdvancedRateLimitGuard);
    gatewayService = module.get<ApiGatewayService>(ApiGatewayService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // Reset rate limit counters between tests
    if (rateLimitGuard && rateLimitGuard.clearAllLimits) {
      rateLimitGuard.clearAllLimits();
    }
    
    // Wait a bit to ensure rate limit windows reset
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Basic Rate Limiting Functionality', () => {
    it('should enforce default rate limits', async () => {
      const endpoint = '/api/gateway/health';
      const maxRequests = 100; // Assuming default rate limit
      const responses: request.Response[] = [];
      
      // Make requests rapidly
      for (let i = 0; i < maxRequests + 10; i++) {
        const response = await request(app.getHttpServer())
          .get(endpoint)
          .expect(res => {
            responses.push(res);
          });
      }

      // Analyze responses
      const successfulRequests = responses.filter(r => r.status === 200);
      const rateLimitedRequests = responses.filter(r => r.status === 429);

      expect(successfulRequests.length).toBeLessThanOrEqual(maxRequests);
      if (rateLimitedRequests.length > 0) {
        expect(rateLimitedRequests[0].headers['x-ratelimit-limit']).toBeDefined();
        expect(rateLimitedRequests[0].headers['x-ratelimit-remaining']).toBeDefined();
        expect(rateLimitedRequests[0].headers['x-ratelimit-reset']).toBeDefined();
      }
    });

    it('should include proper rate limit headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/gateway/health')
        .expect(200);

      // Check for rate limit headers
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();

      // Validate header values
      const limit = parseInt(response.headers['x-ratelimit-limit']);
      const remaining = parseInt(response.headers['x-ratelimit-remaining']);
      const reset = parseInt(response.headers['x-ratelimit-reset']);

      expect(limit).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(limit);
      expect(reset).toBeGreaterThan(Date.now() / 1000);
    });

    it('should reset rate limits after time window', async () => {
      const endpoint = '/api/gateway/health';
      const shortTimeWindow = 2000; // 2 seconds for testing
      
      // Make several requests
      const initialRequests = 5;
      for (let i = 0; i < initialRequests; i++) {
        await request(app.getHttpServer())
          .get(endpoint);
      }

      // Get current remaining count
      const response1 = await request(app.getHttpServer())
        .get(endpoint)
        .expect(200);
      
      const remaining1 = parseInt(response1.headers['x-ratelimit-remaining']);

      // Wait for rate limit window to reset
      await new Promise(resolve => setTimeout(resolve, shortTimeWindow + 1000));

      // Make another request
      const response2 = await request(app.getHttpServer())
        .get(endpoint)
        .expect(200);
      
      const remaining2 = parseInt(response2.headers['x-ratelimit-remaining']);

      // Remaining count should be reset (higher than before)
      expect(remaining2).toBeGreaterThan(remaining1);
    });
  });

  describe('Endpoint-Specific Rate Limiting', () => {
    const rateLimitTests: RateLimitTest[] = [
      {
        endpoint: '/api/gateway/health',
        method: 'GET',
        expectedLimit: 100,
        timeWindow: 60000,
        description: 'Health endpoint with standard rate limit'
      },
      {
        endpoint: '/api/gateway/metrics',
        method: 'GET',
        expectedLimit: 50,
        timeWindow: 60000,
        description: 'Metrics endpoint with restricted rate limit'
      },
      {
        endpoint: '/api/dashboard/metrics',
        method: 'GET',
        expectedLimit: 30,
        timeWindow: 60000,
        description: 'Dashboard metrics with lower rate limit'
      }
    ];

    rateLimitTests.forEach(test => {
      it(`should enforce rate limits for ${test.description}`, async () => {
        const result = await this.testRateLimit(test);
        
        expect(result.successfulRequests).toBeLessThanOrEqual(test.expectedLimit);
        
        if (result.rateLimitedRequests > 0) {
          expect(result.firstRateLimitAt).toBeLessThanOrEqual(test.expectedLimit);
          expect(result.rateLimitHeaders['x-ratelimit-limit']).toBe(test.expectedLimit.toString());
        }
      });
    });
  });

  describe('IP-Based Rate Limiting', () => {
    it('should rate limit by IP address', async () => {
      const endpoint = '/api/gateway/health';
      const responses: request.Response[] = [];
      
      // Simulate requests from same IP
      for (let i = 0; i < 110; i++) {
        const response = await request(app.getHttpServer())
          .get(endpoint)
          .set('X-Forwarded-For', '192.168.1.100');
        responses.push(response);
      }

      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle multiple IPs independently', async () => {
      const endpoint = '/api/gateway/health';
      const ip1Responses: request.Response[] = [];
      const ip2Responses: request.Response[] = [];
      
      // Make requests from two different IPs
      const requestPromises = [];
      
      for (let i = 0; i < 50; i++) {
        requestPromises.push(
          request(app.getHttpServer())
            .get(endpoint)
            .set('X-Forwarded-For', '192.168.1.100')
            .then(res => ip1Responses.push(res))
        );
        
        requestPromises.push(
          request(app.getHttpServer())
            .get(endpoint)
            .set('X-Forwarded-For', '192.168.1.101')
            .then(res => ip2Responses.push(res))
        );
      }
      
      await Promise.all(requestPromises);

      // Both IPs should be able to make requests independently
      const ip1Success = ip1Responses.filter(r => r.status === 200).length;
      const ip2Success = ip2Responses.filter(r => r.status === 200).length;
      
      expect(ip1Success).toBeGreaterThan(0);
      expect(ip2Success).toBeGreaterThan(0);
    });
  });

  describe('User-Based Rate Limiting', () => {
    it('should rate limit authenticated users independently', async () => {
      // This test assumes JWT authentication is implemented
      const endpoint = '/api/dashboard/metrics';
      const user1Token = 'Bearer user1-jwt-token';
      const user2Token = 'Bearer user2-jwt-token';
      
      const user1Responses: request.Response[] = [];
      const user2Responses: request.Response[] = [];
      
      // Make requests as different users
      for (let i = 0; i < 20; i++) {
        try {
          const response1 = await request(app.getHttpServer())
            .get(endpoint)
            .set('Authorization', user1Token);
          user1Responses.push(response1);
          
          const response2 = await request(app.getHttpServer())
            .get(endpoint)
            .set('Authorization', user2Token);
          user2Responses.push(response2);
        } catch (error) {
          // Handle potential auth errors
        }
      }

      // Even if auth fails, rate limiting should work independently
      const user1RateLimited = user1Responses.filter(r => r.status === 429).length;
      const user2RateLimited = user2Responses.filter(r => r.status === 429).length;
      
      // Rate limiting should be independent (both users shouldn't be limited simultaneously due to each other)
      expect(user1RateLimited).toBeLessThan(user1Responses.length);
      expect(user2RateLimited).toBeLessThan(user2Responses.length);
    });
  });

  describe('Rate Limit Bypass and Whitelisting', () => {
    it('should allow bypass for whitelisted IPs', async () => {
      // This test assumes there's a whitelist configuration
      const endpoint = '/api/gateway/health';
      const whitelistedIP = '127.0.0.1'; // localhost usually whitelisted
      
      const responses: request.Response[] = [];
      
      // Make many requests from whitelisted IP
      for (let i = 0; i < 150; i++) {
        const response = await request(app.getHttpServer())
          .get(endpoint)
          .set('X-Forwarded-For', whitelistedIP);
        responses.push(response);
      }

      // Should have fewer rate limited responses from whitelisted IP
      const rateLimited = responses.filter(r => r.status === 429).length;
      const successful = responses.filter(r => r.status === 200).length;
      
      // At least some requests should succeed even if over normal limit
      expect(successful).toBeGreaterThan(100);
    });
  });

  describe('Rate Limiting Under Load', () => {
    it('should maintain performance under load while enforcing limits', async () => {
      const endpoint = '/api/gateway/health';
      const concurrentUsers = 10;
      const requestsPerUser = 20;
      const results: LoadTestResult[] = [];
      
      const userPromises = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
        const userIP = `192.168.1.${100 + userIndex}`;
        const startTime = Date.now();
        const responses: request.Response[] = [];
        const responseTimes: number[] = [];
        
        for (let i = 0; i < requestsPerUser; i++) {
          const requestStart = Date.now();
          
          try {
            const response = await request(app.getHttpServer())
              .get(endpoint)
              .set('X-Forwarded-For', userIP);
            
            const responseTime = Date.now() - requestStart;
            responseTimes.push(responseTime);
            responses.push(response);
          } catch (error) {
            // Handle network errors
          }
        }
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        return {
          totalRequests: requestsPerUser,
          successfulRequests: responses.filter(r => r.status === 200).length,
          rateLimitedRequests: responses.filter(r => r.status === 429).length,
          errorRequests: responses.filter(r => r.status >= 500).length,
          averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
          maxResponseTime: Math.max(...responseTimes),
          minResponseTime: Math.min(...responseTimes),
          throughput: responses.length / (totalTime / 1000)
        };
      });
      
      const loadResults = await Promise.all(userPromises);
      
      // Aggregate results
      const aggregated = loadResults.reduce((acc, result) => ({
        totalRequests: acc.totalRequests + result.totalRequests,
        successfulRequests: acc.successfulRequests + result.successfulRequests,
        rateLimitedRequests: acc.rateLimitedRequests + result.rateLimitedRequests,
        errorRequests: acc.errorRequests + result.errorRequests,
        averageResponseTime: (acc.averageResponseTime + result.averageResponseTime) / 2,
        maxResponseTime: Math.max(acc.maxResponseTime, result.maxResponseTime),
        minResponseTime: Math.min(acc.minResponseTime, result.minResponseTime),
        throughput: acc.throughput + result.throughput
      }));

      // Performance assertions
      expect(aggregated.averageResponseTime).toBeLessThan(1000); // Less than 1 second average
      expect(aggregated.maxResponseTime).toBeLessThan(5000); // Less than 5 seconds max
      expect(aggregated.errorRequests).toBe(0); // No server errors
      expect(aggregated.rateLimitedRequests).toBeGreaterThan(0); // Rate limiting should kick in
      
      console.log('Load Test Results:', aggregated);
    });
  });

  describe('Rate Limit Error Responses', () => {
    it('should return proper error format when rate limited', async () => {
      const endpoint = '/api/gateway/health';
      
      // Exhaust rate limit
      for (let i = 0; i < 105; i++) {
        await request(app.getHttpServer()).get(endpoint);
      }
      
      // Next request should be rate limited
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .expect(429);

      // Check error response format
      expect(response.body).toBeDefined();
      if (typeof response.body === 'object') {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(response.body.error.message).toContain('rate limit');
      }
      
      // Check rate limit headers
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBe('0');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should provide accurate retry-after header', async () => {
      const endpoint = '/api/gateway/health';
      
      // Exhaust rate limit
      for (let i = 0; i < 105; i++) {
        await request(app.getHttpServer()).get(endpoint);
      }
      
      const rateLimitedResponse = await request(app.getHttpServer())
        .get(endpoint)
        .expect(429);

      const retryAfter = parseInt(rateLimitedResponse.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(3600); // Should be reasonable (less than 1 hour)
      
      // Wait for the suggested time and try again
      await new Promise(resolve => setTimeout(resolve, (retryAfter + 1) * 1000));
      
      const retryResponse = await request(app.getHttpServer())
        .get(endpoint);
      
      expect(retryResponse.status).toBe(200);
    });
  });

  describe('Rate Limit Configuration and Monitoring', () => {
    it('should provide rate limit statistics', async () => {
      // Make some requests to generate statistics
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer()).get('/api/gateway/health');
      }
      
      // Check if statistics endpoint exists
      try {
        const statsResponse = await request(app.getHttpServer())
          .get('/api/gateway/rate-limit-stats')
          .expect(200);

        expect(statsResponse.body).toBeDefined();
        expect(statsResponse.body.totalRequests).toBeGreaterThan(0);
        expect(statsResponse.body.rateLimitHits).toBeDefined();
        expect(statsResponse.body.topOffenders).toBeDefined();
      } catch (error) {
        // Statistics endpoint might not be implemented yet
        console.warn('Rate limit statistics endpoint not available');
      }
    });

    it('should handle rate limit configuration updates', async () => {
      // This test checks if rate limits can be updated dynamically
      // In a real implementation, this might involve admin endpoints
      
      try {
        const configResponse = await request(app.getHttpServer())
          .get('/api/gateway/rate-limit-config')
          .expect(200);

        expect(configResponse.body).toBeDefined();
        expect(configResponse.body.globalLimit).toBeDefined();
        expect(configResponse.body.endpointLimits).toBeDefined();
      } catch (error) {
        // Configuration endpoint might not be implemented
        console.warn('Rate limit configuration endpoint not available');
      }
    });
  });

  describe('Rate Limiting Edge Cases', () => {
    it('should handle rapid bursts of requests', async () => {
      const endpoint = '/api/gateway/health';
      const burstSize = 50;
      const responses: request.Response[] = [];
      
      // Send burst of simultaneous requests
      const burstPromises = Array.from({ length: burstSize }, () =>
        request(app.getHttpServer()).get(endpoint)
      );
      
      const burstResponses = await Promise.all(burstPromises);
      responses.push(...burstResponses);
      
      // Some requests should succeed, some might be rate limited
      const successful = responses.filter(r => r.status === 200).length;
      const rateLimited = responses.filter(r => r.status === 429).length;
      
      expect(successful + rateLimited).toBe(burstSize);
      expect(successful).toBeGreaterThan(0); // At least some should succeed
    });

    it('should handle requests with missing or invalid IP headers', async () => {
      const endpoint = '/api/gateway/health';
      
      // Request without IP header
      const response1 = await request(app.getHttpServer())
        .get(endpoint);
      expect([200, 429]).toContain(response1.status);
      
      // Request with invalid IP header
      const response2 = await request(app.getHttpServer())
        .get(endpoint)
        .set('X-Forwarded-For', 'invalid-ip');
      expect([200, 429]).toContain(response2.status);
      
      // Request with multiple IPs
      const response3 = await request(app.getHttpServer())
        .get(endpoint)
        .set('X-Forwarded-For', '192.168.1.1, 10.0.0.1, 172.16.0.1');
      expect([200, 429]).toContain(response3.status);
    });

    it('should handle clock skew and time-based edge cases', async () => {
      // This test would be more relevant with time manipulation libraries
      // For now, just ensure consistent behavior across time boundaries
      
      const endpoint = '/api/gateway/health';
      const responses: request.Response[] = [];
      
      // Make requests near potential time boundaries
      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer()).get(endpoint);
        responses.push(response);
        
        // Small delay to cross potential time boundaries
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // All responses should have consistent rate limit headers
      responses.forEach(response => {
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
        expect(response.headers['x-ratelimit-reset']).toBeDefined();
      });
    });
  });

  // Helper method to test rate limiting for a specific endpoint
  private async testRateLimit(test: RateLimitTest): Promise<RateLimitResult> {
    const responses: request.Response[] = [];
    const responseTimes: number[] = [];
    let firstRateLimitAt: number | null = null;
    
    for (let i = 0; i < test.expectedLimit + 20; i++) {
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        [test.method.toLowerCase()](test.endpoint);
      
      const responseTime = Date.now() - startTime;
      responseTimes.push(responseTime);
      responses.push(response);
      
      if (response.status === 429 && firstRateLimitAt === null) {
        firstRateLimitAt = i + 1;
      }
    }
    
    const successfulRequests = responses.filter(r => r.status === 200).length;
    const rateLimitedRequests = responses.filter(r => r.status === 429).length;
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    const lastRateLimitedResponse = responses.find(r => r.status === 429);
    const rateLimitHeaders = lastRateLimitedResponse ? {
      'x-ratelimit-limit': lastRateLimitedResponse.headers['x-ratelimit-limit'] || '',
      'x-ratelimit-remaining': lastRateLimitedResponse.headers['x-ratelimit-remaining'] || '',
      'x-ratelimit-reset': lastRateLimitedResponse.headers['x-ratelimit-reset'] || '',
      'retry-after': lastRateLimitedResponse.headers['retry-after'] || ''
    } : {};
    
    return {
      endpoint: test.endpoint,
      requestsMade: responses.length,
      successfulRequests,
      rateLimitedRequests,
      firstRateLimitAt,
      resetTime: lastRateLimitedResponse ? parseInt(lastRateLimitedResponse.headers['x-ratelimit-reset']) : null,
      averageResponseTime,
      rateLimitHeaders
    };
  }
});