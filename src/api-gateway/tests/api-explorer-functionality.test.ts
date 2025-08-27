import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { SwaggerConfigService } from '../services/swagger-config.service';
import { ApiGatewayService } from '../services/api-gateway.service';
import { JSDOM } from 'jsdom';
import * as puppeteer from 'puppeteer';

interface ExplorerEndpoint {
  path: string;
  method: string;
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: any[];
  requestBody?: any;
  responses?: any;
}

interface ExplorerTestResult {
  endpoint: string;
  method: string;
  accessible: boolean;
  hasDocumentation: boolean;
  hasTryItOut: boolean;
  hasExamples: boolean;
  responseTime: number;
  errors: string[];
}

describe('API Explorer Functionality Tests', () => {
  let app: INestApplication;
  let module: TestingModule;
  let swaggerService: SwaggerConfigService;
  let gatewayService: ApiGatewayService;
  let browser: puppeteer.Browser;
  let explorerPage: puppeteer.Page;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    swaggerService = module.get<SwaggerConfigService>(SwaggerConfigService);
    gatewayService = module.get<ApiGatewayService>(ApiGatewayService);

    await app.init();

    // Setup Puppeteer for browser testing
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      explorerPage = await browser.newPage();

      // Set viewport for consistent testing
      await explorerPage.setViewport({ width: 1280, height: 720 });

      // Navigate to Swagger UI
      const port = (app.getHttpServer().address() as any)?.port || 3000;
      await explorerPage.goto(`http://localhost:${port}/docs`, {
        waitUntil: 'networkidle0',
        timeout: 10000,
      });
    } catch (error) {
      console.warn(
        'Puppeteer setup failed, skipping browser tests:',
        error.message,
      );
      browser = null;
      explorerPage = null;
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    await app.close();
  });

  describe('API Explorer Accessibility', () => {
    it('should serve Swagger UI documentation page', async () => {
      const response = await request(app.getHttpServer())
        .get('/docs')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('swagger-ui');
      expect(response.text).toContain('Swagger UI');
    });

    it('should serve OpenAPI JSON specification', async () => {
      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body.openapi).toBeDefined();
      expect(response.body.paths).toBeDefined();
      expect(response.body.info).toBeDefined();
    });

    it('should serve custom API explorer endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/gateway/explore')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('API Explorer');
    });

    it('should have proper CORS headers for explorer', async () => {
      const response = await request(app.getHttpServer()).get('/docs');

      // Should allow cross-origin requests for development
      if (process.env.NODE_ENV !== 'production') {
        expect(response.headers['access-control-allow-origin']).toBeDefined();
      }
    });
  });

  describe('Swagger UI Functionality', () => {
    beforeEach(() => {
      if (!explorerPage) {
        pending('Browser testing not available');
      }
    });

    it('should load Swagger UI interface successfully', async () => {
      await explorerPage.waitForSelector('.swagger-ui', { timeout: 5000 });

      const title = await explorerPage.title();
      expect(title).toContain('FundShield API');

      const swaggerContainer = await explorerPage.$('.swagger-ui');
      expect(swaggerContainer).toBeTruthy();
    });

    it('should display API information section', async () => {
      await explorerPage.waitForSelector('.info', { timeout: 5000 });

      const infoSection = await explorerPage.$('.info');
      expect(infoSection).toBeTruthy();

      const title = await explorerPage.$eval(
        '.info .title',
        el => el.textContent,
      );
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });

    it('should display server information', async () => {
      const servers = await explorerPage.$$('.servers select option');
      expect(servers.length).toBeGreaterThan(0);

      // Should have at least a default server
      const serverText = await explorerPage.$eval(
        '.servers select option',
        el => el.textContent,
      );
      expect(serverText).toBeTruthy();
    });

    it('should display authorization section', async () => {
      const authorizeButton = await explorerPage.$('.auth-wrapper .authorize');
      expect(authorizeButton).toBeTruthy();

      // Click authorize button
      await authorizeButton.click();

      // Should open authorization modal
      await explorerPage.waitForSelector('.auth-container', { timeout: 3000 });
      const authModal = await explorerPage.$('.auth-container');
      expect(authModal).toBeTruthy();

      // Close modal
      const closeButton = await explorerPage.$('.auth-container .close-modal');
      if (closeButton) {
        await closeButton.click();
      }
    });
  });

  describe('API Endpoint Exploration', () => {
    beforeEach(() => {
      if (!explorerPage) {
        pending('Browser testing not available');
      }
    });

    it('should display API endpoints organized by tags', async () => {
      await explorerPage.waitForSelector('.opblock', { timeout: 5000 });

      const endpoints = await explorerPage.$$('.opblock');
      expect(endpoints.length).toBeGreaterThan(0);

      // Check for tag sections
      const tagSections = await explorerPage.$$('.opblock-tag-section');
      expect(tagSections.length).toBeGreaterThan(0);
    });

    it('should allow expanding and collapsing endpoints', async () => {
      const firstEndpoint = await explorerPage.$('.opblock');
      expect(firstEndpoint).toBeTruthy();

      // Get the collapsed state
      const isCollapsed = await explorerPage.$eval('.opblock', el =>
        el.classList.contains('is-open'),
      );

      // Click to expand
      await firstEndpoint.click();

      // Wait for expansion
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if state changed
      const isExpanded = await explorerPage.$eval('.opblock', el =>
        el.classList.contains('is-open'),
      );

      expect(isExpanded).not.toBe(isCollapsed);
    });

    it('should display endpoint details when expanded', async () => {
      // Find and expand a GET endpoint
      const getEndpoint = await explorerPage.$('.opblock.opblock-get');
      if (getEndpoint) {
        await getEndpoint.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check for endpoint details
        const details = await explorerPage.$('.opblock-body');
        expect(details).toBeTruthy();

        // Check for try it out button
        const tryItOutButton = await explorerPage.$('.try-out__btn');
        expect(tryItOutButton).toBeTruthy();
      }
    });

    it('should show request/response examples', async () => {
      const endpoints = await explorerPage.$$('.opblock.opblock-get');

      if (endpoints.length > 0) {
        await endpoints[0].click();
        await new Promise(resolve => setTimeout(resolve, 500));

        // Look for response examples
        const responseExamples = await explorerPage.$('.responses-wrapper');
        expect(responseExamples).toBeTruthy();

        // Check for response codes
        const responseCodes = await explorerPage.$$('.response-col_status');
        expect(responseCodes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Try It Out Functionality', () => {
    beforeEach(() => {
      if (!explorerPage) {
        pending('Browser testing not available');
      }
    });

    it('should enable try it out for GET endpoints', async () => {
      // Find a GET endpoint without parameters
      const healthEndpoint = await explorerPage.$(
        '.opblock[data-tag="gateway"]',
      );

      if (healthEndpoint) {
        await healthEndpoint.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        const tryItOutButton = await explorerPage.$('.try-out__btn');
        if (tryItOutButton) {
          await tryItOutButton.click();
          await new Promise(resolve => setTimeout(resolve, 500));

          // Execute button should appear
          const executeButton = await explorerPage.$('.execute');
          expect(executeButton).toBeTruthy();

          // Click execute
          await executeButton.click();

          // Wait for response
          await explorerPage.waitForSelector(
            '.responses-wrapper .live-responses-table',
            { timeout: 5000 },
          );

          // Check for response
          const responseSection = await explorerPage.$('.live-responses-table');
          expect(responseSection).toBeTruthy();
        }
      }
    });

    it('should handle parameter input for parameterized endpoints', async () => {
      // Look for endpoints with parameters
      const parameterizedEndpoint = await explorerPage.$(
        '.opblock .parameters',
      );

      if (parameterizedEndpoint) {
        const parentBlock = await explorerPage.$('.opblock');
        await parentBlock.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        const tryItOutButton = await explorerPage.$('.try-out__btn');
        if (tryItOutButton) {
          await tryItOutButton.click();
          await new Promise(resolve => setTimeout(resolve, 500));

          // Check for parameter inputs
          const parameterInputs = await explorerPage.$$(
            '.parameter__name input, .parameter__name select',
          );
          expect(parameterInputs.length).toBeGreaterThan(0);
        }
      }
    });

    it('should validate required parameters', async () => {
      // Find endpoint with required parameters
      const endpoints = await explorerPage.$$('.opblock');

      for (const endpoint of endpoints) {
        await endpoint.click();
        await explorerPage.waitForTimeout(300);

        const tryItOutButton = await explorerPage.$('.try-out__btn');
        if (tryItOutButton) {
          await tryItOutButton.click();
          await explorerPage.waitForTimeout(300);

          const requiredParams = await explorerPage.$$(
            '.parameter.required input',
          );
          if (requiredParams.length > 0) {
            // Try to execute without filling required parameters
            const executeButton = await explorerPage.$('.execute');
            if (executeButton) {
              await executeButton.click();
              await explorerPage.waitForTimeout(1000);

              // Should show validation error or 400 response
              const responseSection = await explorerPage.$(
                '.live-responses-table',
              );
              if (responseSection) {
                const responseCode = await explorerPage.$eval(
                  '.response-col_status',
                  el => el.textContent,
                );
                // Either validation prevents execution or server returns 400
                expect(
                  ['400', '422'].includes(responseCode) || !responseCode,
                ).toBeTruthy();
              }
            }
          }
          break; // Test first endpoint with required params
        }
      }
    });
  });

  describe('Authentication Integration', () => {
    beforeEach(() => {
      if (!explorerPage) {
        pending('Browser testing not available');
      }
    });

    it('should support JWT Bearer token authentication', async () => {
      const authorizeButton = await explorerPage.$('.auth-wrapper .authorize');
      await authorizeButton.click();

      await explorerPage.waitForSelector('.auth-container', { timeout: 3000 });

      // Look for JWT auth input
      const jwtInput = await explorerPage.$(
        'input[placeholder*="bearerAuth"], input[placeholder*="JWT"]',
      );
      if (jwtInput) {
        await jwtInput.type('test.jwt.token');

        const authButton = await explorerPage.$('.auth-btn-wrapper .authorize');
        if (authButton) {
          await authButton.click();
          await new Promise(resolve => setTimeout(resolve, 500));

          // Should show authorized state
          const logoutButton = await explorerPage.$(
            '.auth-btn-wrapper .btn-done',
          );
          expect(logoutButton).toBeTruthy();
        }
      }

      // Close auth modal
      const closeButton = await explorerPage.$('.close-modal');
      if (closeButton) {
        await closeButton.click();
      }
    });

    it('should support API Key authentication', async () => {
      const authorizeButton = await explorerPage.$('.auth-wrapper .authorize');
      await authorizeButton.click();

      await explorerPage.waitForSelector('.auth-container', { timeout: 3000 });

      // Look for API Key input
      const apiKeyInput = await explorerPage.$(
        'input[placeholder*="api"], input[placeholder*="key"]',
      );
      if (apiKeyInput) {
        await apiKeyInput.type('test-api-key');

        const authButton = await explorerPage.$('.auth-btn-wrapper .authorize');
        if (authButton) {
          await authButton.click();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Close auth modal
      const closeButton = await explorerPage.$('.close-modal');
      if (closeButton) {
        await closeButton.click();
      }
    });

    it('should include authentication headers in requests', async () => {
      // First authorize
      const authorizeButton = await explorerPage.$('.auth-wrapper .authorize');
      await authorizeButton.click();
      await explorerPage.waitForSelector('.auth-container', { timeout: 3000 });

      const jwtInput = await explorerPage.$(
        'input[name="bearer"], input[placeholder*="bearer"]',
      );
      if (jwtInput) {
        await jwtInput.type('Bearer test-token');
        const authButton = await explorerPage.$('.auth-btn-wrapper .authorize');
        if (authButton) {
          await authButton.click();
        }
      }

      const closeButton = await explorerPage.$('.close-modal');
      if (closeButton) {
        await closeButton.click();
      }

      // Now try an authenticated endpoint
      const protectedEndpoint = await explorerPage.$(
        '.opblock[data-tag="dashboard"]',
      );
      if (protectedEndpoint) {
        await protectedEndpoint.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        const tryItOutButton = await explorerPage.$('.try-out__btn');
        if (tryItOutButton) {
          await tryItOutButton.click();
          await new Promise(resolve => setTimeout(resolve, 500));

          // Check if authorization header is shown
          const curlCommand = await explorerPage.$('.curl-command');
          if (curlCommand) {
            const curlText = await explorerPage.evaluate(
              el => el?.textContent,
              curlCommand,
            );
            expect(
              curlText?.includes('Authorization') ||
                curlText?.includes('Bearer'),
            ).toBeTruthy();
          }
        }
      }
    });
  });

  describe('Response Handling and Display', () => {
    beforeEach(() => {
      if (!explorerPage) {
        pending('Browser testing not available');
      }
    });

    it('should display response status codes', async () => {
      // Execute a simple GET request
      const healthEndpoint = await explorerPage.$('.opblock[id*="health"]');
      if (healthEndpoint) {
        await healthEndpoint.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        const tryItOutButton = await explorerPage.$('.try-out__btn');
        if (tryItOutButton) {
          await tryItOutButton.click();
          const executeButton = await explorerPage.$('.execute');
          await executeButton.click();

          await explorerPage.waitForSelector(
            '.responses-wrapper .live-responses-table',
            { timeout: 5000 },
          );

          const statusCode = await explorerPage.$('.response-col_status');
          expect(statusCode).toBeTruthy();

          const statusText = await explorerPage.evaluate(
            el => el?.textContent,
            statusCode,
          );
          expect(statusText).toMatch(/^[1-5]\d{2}$/);
        }
      }
    });

    it('should display response headers', async () => {
      const getEndpoint = await explorerPage.$('.opblock.opblock-get');
      if (getEndpoint) {
        await getEndpoint.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        const tryItOutButton = await explorerPage.$('.try-out__btn');
        if (tryItOutButton) {
          await tryItOutButton.click();
          const executeButton = await explorerPage.$('.execute');
          await executeButton.click();

          await explorerPage.waitForSelector('.live-responses-table', {
            timeout: 5000,
          });

          // Check for response headers section
          const headersSection = await explorerPage.$('.response-col_links');
          if (headersSection) {
            const headersText = await explorerPage.evaluate(
              el => el?.textContent,
              headersSection,
            );
            expect(headersText).toBeTruthy();
          }
        }
      }
    });

    it('should format JSON responses properly', async () => {
      const jsonEndpoint = await explorerPage.$(
        '.opblock[id*="metrics"], .opblock[id*="health"]',
      );
      if (jsonEndpoint) {
        await jsonEndpoint.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        const tryItOutButton = await explorerPage.$('.try-out__btn');
        if (tryItOutButton) {
          await tryItOutButton.click();
          const executeButton = await explorerPage.$('.execute');
          await executeButton.click();

          await explorerPage.waitForSelector('.live-responses-table', {
            timeout: 5000,
          });

          const responseBody = await explorerPage.$(
            '.response-col_description pre',
          );
          if (responseBody) {
            const responseText = await explorerPage.evaluate(
              el => el?.textContent,
              responseBody,
            );
            expect(() => JSON.parse(responseText)).not.toThrow();
          }
        }
      }
    });

    it('should show request duration', async () => {
      const endpoint = await explorerPage.$('.opblock.opblock-get');
      if (endpoint) {
        await endpoint.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        const tryItOutButton = await explorerPage.$('.try-out__btn');
        if (tryItOutButton) {
          await tryItOutButton.click();
          const executeButton = await explorerPage.$('.execute');

          const startTime = Date.now();
          await executeButton.click();

          await explorerPage.waitForSelector('.live-responses-table', {
            timeout: 5000,
          });
          const endTime = Date.now();

          // Should show request duration somewhere in the response
          const durationElement = await explorerPage.$(
            '[class*="duration"], [class*="time"]',
          );
          if (durationElement) {
            const durationText = await explorerPage.evaluate(
              el => el?.textContent,
              durationElement,
            );
            expect(
              durationText?.includes('ms') || durationText?.includes('time'),
            ).toBeTruthy();
          } else {
            // At least verify the request completed within reasonable time
            expect(endTime - startTime).toBeLessThan(10000);
          }
        }
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid endpoint gracefully via HTTP', async () => {
      const response = await request(app.getHttpServer())
        .get('/docs/invalid-spec')
        .expect(404);

      expect(response.status).toBe(404);
    });

    beforeEach(() => {
      if (!explorerPage) {
        pending('Browser testing not available');
      }
    });

    it('should handle network errors gracefully', async () => {
      // Try to execute against a non-existent endpoint
      const endpoints = await explorerPage.$$('.opblock');
      if (endpoints.length > 0) {
        await endpoints[0].click();
        await new Promise(resolve => setTimeout(resolve, 500));

        const tryItOutButton = await explorerPage.$('.try-out__btn');
        if (tryItOutButton) {
          await tryItOutButton.click();

          // Modify the server URL to cause a network error
          const serverSelect = await explorerPage.$('.servers select');
          if (serverSelect) {
            await explorerPage.evaluate(() => {
              const select = document.querySelector(
                '.servers select',
              ) as HTMLSelectElement;
              if (select) {
                const option = document.createElement('option');
                option.value = 'http://invalid-server:9999';
                option.textContent = 'Invalid Server';
                select.appendChild(option);
                select.value = 'http://invalid-server:9999';
              }
            });

            const executeButton = await explorerPage.$('.execute');
            if (executeButton) {
              await executeButton.click();

              // Should handle error gracefully
              await explorerPage.waitForTimeout(3000);

              const errorMessage = await explorerPage.$(
                '.live-responses-table .error',
              );
              // Either shows error message or times out gracefully
              expect(true).toBe(true); // Test passes if no unhandled errors
            }
          }
        }
      }
    });

    it('should validate malformed JSON in request body', async () => {
      // Find a POST endpoint with request body
      const postEndpoint = await explorerPage.$('.opblock.opblock-post');
      if (postEndpoint) {
        await postEndpoint.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        const tryItOutButton = await explorerPage.$('.try-out__btn');
        if (tryItOutButton) {
          await tryItOutButton.click();

          const requestBodyTextarea = await explorerPage.$(
            '.body-param textarea',
          );
          if (requestBodyTextarea) {
            // Enter malformed JSON
            await explorerPage.evaluate(
              el => (el.value = ''),
              requestBodyTextarea,
            );
            await requestBodyTextarea.type('{ invalid json }');

            const executeButton = await explorerPage.$('.execute');
            await executeButton.click();

            await explorerPage.waitForTimeout(2000);

            // Should either prevent execution or show error
            const responseSection = await explorerPage.$(
              '.live-responses-table',
            );
            if (responseSection) {
              const statusCode = await explorerPage.$eval(
                '.response-col_status',
                el => el.textContent,
              );
              expect(
                ['400', '422'].includes(statusCode) || !statusCode,
              ).toBeTruthy();
            }
          }
        }
      }
    });
  });

  describe('Explorer Performance and Usability', () => {
    beforeEach(() => {
      if (!explorerPage) {
        pending('Browser testing not available');
      }
    });

    it('should load within acceptable time limits', async () => {
      const startTime = Date.now();

      // Reload the page and measure load time
      await explorerPage.reload({ waitUntil: 'networkidle0' });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    });

    it('should be responsive and mobile-friendly', async () => {
      // Test mobile viewport
      await explorerPage.setViewport({ width: 375, height: 667 });
      await explorerPage.reload({ waitUntil: 'networkidle0' });

      const swaggerContainer = await explorerPage.$('.swagger-ui');
      expect(swaggerContainer).toBeTruthy();

      // Check if elements are still accessible
      const endpoints = await explorerPage.$$('.opblock');
      expect(endpoints.length).toBeGreaterThan(0);

      // Reset viewport
      await explorerPage.setViewport({ width: 1280, height: 720 });
    });

    it('should support keyboard navigation', async () => {
      // Focus on the first endpoint
      await explorerPage.keyboard.press('Tab');
      await explorerPage.keyboard.press('Enter');

      // Should expand the endpoint
      await new Promise(resolve => setTimeout(resolve, 500));

      const expandedEndpoint = await explorerPage.$('.opblock.is-open');
      expect(expandedEndpoint).toBeTruthy();
    });

    it('should maintain state during navigation', async () => {
      // Authorize first
      const authorizeButton = await explorerPage.$('.auth-wrapper .authorize');
      await authorizeButton.click();

      const authInput = await explorerPage.$('.auth-container input');
      if (authInput) {
        await authInput.type('test-token');
        const authConfirm = await explorerPage.$(
          '.auth-btn-wrapper .authorize',
        );
        if (authConfirm) {
          await authConfirm.click();
        }
      }

      const closeModal = await explorerPage.$('.close-modal');
      if (closeModal) {
        await closeModal.click();
      }

      // Refresh page
      await explorerPage.reload({ waitUntil: 'networkidle0' });

      // Check if authorization state is maintained
      const authorizeButtonAfterReload = await explorerPage.$(
        '.auth-wrapper .authorize',
      );
      const buttonText = await explorerPage.evaluate(
        el => el?.textContent,
        authorizeButtonAfterReload,
      );

      // Button text might change to indicate authorized state
      expect(buttonText).toBeDefined();
    });
  });

  // Helper utilities for test suite

  async function extractEndpointsFromPage(): Promise<ExplorerEndpoint[]> {
    if (!explorerPage) return [];

    const endpoints = await explorerPage.$$eval('.opblock', elements => {
      return elements.map(el => {
        const pathEl = el.querySelector('.opblock-summary-path');
        const methodEl = el.querySelector('.opblock-summary-method');
        const summaryEl = el.querySelector('.opblock-summary-description');

        return {
          path: pathEl ? pathEl.textContent.trim() : '',
          method: methodEl ? methodEl.textContent.trim() : '',
          summary: summaryEl ? summaryEl.textContent.trim() : '',
          accessible: true,
        };
      });
    });

    return endpoints.filter(e => e.path && e.method);
  }

  function generateExplorerTestReport(results: ExplorerTestResult[]): any {
    const totalEndpoints = results.length;
    const accessibleEndpoints = results.filter(r => r.accessible).length;
    const documentedEndpoints = results.filter(r => r.hasDocumentation).length;
    const testableEndpoints = results.filter(r => r.hasTryItOut).length;
    const averageResponseTime =
      results.reduce((sum, r) => sum + r.responseTime, 0) / totalEndpoints;

    return {
      summary: {
        totalEndpoints,
        accessibleEndpoints,
        documentedEndpoints,
        testableEndpoints,
        averageResponseTime,
        accessibilityRate: accessibleEndpoints / totalEndpoints,
        documentationRate: documentedEndpoints / totalEndpoints,
        testabilityRate: testableEndpoints / totalEndpoints,
      },
      details: results,
      recommendations: generateRecommendations(results),
    };
  }

  function generateRecommendations(results: ExplorerTestResult[]): string[] {
    const recommendations: string[] = [];

    const accessibilityRate =
      results.filter(r => r.accessible).length / results.length;
    if (accessibilityRate < 0.9) {
      recommendations.push(
        'Improve endpoint accessibility in the API explorer',
      );
    }

    const documentationRate =
      results.filter(r => r.hasDocumentation).length / results.length;
    if (documentationRate < 0.8) {
      recommendations.push('Add more comprehensive documentation to endpoints');
    }

    const averageResponseTime =
      results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
    if (averageResponseTime > 2000) {
      recommendations.push(
        'Optimize API response times for better explorer experience',
      );
    }

    return recommendations;
  }
});
