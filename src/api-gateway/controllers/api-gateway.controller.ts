import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ApiGatewayService, GatewayMetrics } from '../services/api-gateway.service';
import { VersioningService, VersionMeta } from '../services/versioning.service';
import { SwaggerConfigService } from '../services/swagger-config.service';
import { VersionNeutral } from '../decorators/versioning.decorators';
import {
  ApiOperationEnhanced,
  ApiResponseEnhanced,
  ApiErrorResponses,
  ApiVersioned,
  ApiQueryEnhanced,
  ApiParamEnhanced,
} from '../decorators/api-docs.decorators';

class ApiExplorerRequest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  queryParams?: Record<string, string>;
}

class EndpointInfo {
  path: string;
  method: string;
  description: string;
  parameters: any[];
  responses: any[];
  examples: any[];
  version: string;
}

@ApiTags('API Gateway')
@Controller('api/gateway')
@VersionNeutral()
export class ApiGatewayController {
  private readonly logger = new Logger(ApiGatewayController.name);

  constructor(
    private readonly gatewayService: ApiGatewayService,
    private readonly versioningService: VersioningService,
    private readonly swaggerService: SwaggerConfigService,
  ) {}

  @Get('health')
  @ApiOperationEnhanced({
    summary: 'API Gateway Health Check',
    description: 'Check the health and status of the API Gateway including metrics and configuration.',
    tags: ['Health', 'Monitoring'],
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Gateway health information',
  })
  getGatewayHealth(): any {
    const metrics = this.gatewayService.getMetrics();
    const config = this.gatewayService.getConfig();
    const versionMeta = this.versioningService.getVersionMeta();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      gateway: {
        version: '1.0.0',
        uptime: process.uptime(),
        metrics,
        configuration: {
          versioning: config.versioning,
          rateLimit: config.rateLimit.global,
          analytics: config.analytics.enabled,
          transformation: {
            request: config.transformation.request.enabled,
            response: config.transformation.response.enabled,
          },
        },
        supportedVersions: versionMeta,
      },
    };
  }

  @Get('metrics')
  @ApiOperationEnhanced({
    summary: 'Get API Gateway Metrics',
    description: 'Retrieve detailed metrics about API Gateway performance and usage.',
    tags: ['Monitoring', 'Analytics'],
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Gateway metrics data',
  })
  getGatewayMetrics(): GatewayMetrics {
    return this.gatewayService.getMetrics();
  }

  @Get('routes')
  @ApiOperationEnhanced({
    summary: 'Get Registered Routes',
    description: 'List all routes registered with the API Gateway including their configurations.',
    tags: ['Configuration'],
  })
  @ApiQueryEnhanced({
    name: 'version',
    description: 'Filter routes by API version',
    required: false,
    example: 'v1',
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'List of registered routes',
  })
  getRoutes(@Query('version') version?: string): any {
    const routes = this.gatewayService.getRoutes();
    
    const filteredRoutes = version 
      ? routes.filter(route => route.version === version)
      : routes;

    return {
      total: filteredRoutes.length,
      version: version || 'all',
      routes: filteredRoutes.map(route => ({
        path: route.path,
        method: route.method,
        version: route.version,
        rateLimit: route.rateLimit,
        analytics: route.analytics,
        transform: route.transform,
      })),
    };
  }

  @Get('explore')
  @ApiOperationEnhanced({
    summary: 'API Explorer Interface',
    description: 'Interactive API explorer for testing endpoints with real-time examples and responses.',
    tags: ['Explorer', 'Interactive'],
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'API explorer interface HTML',
  })
  getApiExplorer(@Res() res: Response): void {
    const explorerHtml = this.generateApiExplorerHtml();
    res.setHeader('Content-Type', 'text/html');
    res.send(explorerHtml);
  }

  @Get('explore/endpoints')
  @ApiOperationEnhanced({
    summary: 'Get Available Endpoints',
    description: 'Get a list of all available endpoints for the API explorer.',
    tags: ['Explorer'],
  })
  @ApiVersioned(['v1', 'v2'])
  @ApiQueryEnhanced({
    name: 'tag',
    description: 'Filter endpoints by tag',
    required: false,
  })
  @ApiQueryEnhanced({
    name: 'version',
    description: 'Filter endpoints by version',
    required: false,
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'List of available endpoints',
  })
  getAvailableEndpoints(
    @Query('tag') tag?: string,
    @Query('version') version?: string,
  ): any {
    // This would normally fetch from the actual Swagger document
    // For demo purposes, returning a curated list
    const endpoints: EndpointInfo[] = [
      {
        path: '/auth/login',
        method: 'POST',
        description: 'User authentication',
        parameters: [],
        responses: [{ status: 200, description: 'Login successful' }],
        examples: [
          {
            name: 'Standard Login',
            request: {
              email: 'user@fundshield.com',
              password: 'SecurePassword123!',
            },
            response: {
              success: true,
              data: {
                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                user: {
                  id: '123e4567-e89b-12d3-a456-426614174000',
                  email: 'user@fundshield.com',
                  role: 'user',
                },
              },
            },
          },
        ],
        version: 'v1',
      },
      {
        path: '/users',
        method: 'GET',
        description: 'Get users list',
        parameters: [
          { name: 'page', type: 'query', description: 'Page number' },
          { name: 'limit', type: 'query', description: 'Items per page' },
        ],
        responses: [{ status: 200, description: 'Users retrieved successfully' }],
        examples: [
          {
            name: 'Paginated Users',
            request: { page: 1, limit: 10 },
            response: {
              success: true,
              data: [
                {
                  id: '123e4567-e89b-12d3-a456-426614174000',
                  email: 'user1@fundshield.com',
                  firstName: 'John',
                  lastName: 'Doe',
                },
              ],
              metadata: {
                pagination: {
                  page: 1,
                  limit: 10,
                  total: 50,
                  totalPages: 5,
                },
              },
            },
          },
        ],
        version: 'v1',
      },
    ];

    let filtered = endpoints;
    
    if (version) {
      filtered = filtered.filter(endpoint => endpoint.version === version);
    }
    
    if (tag) {
      // In a real implementation, endpoints would have tags
      // For now, we'll filter by path containing the tag
      filtered = filtered.filter(endpoint => 
        endpoint.path.toLowerCase().includes(tag.toLowerCase())
      );
    }

    return {
      total: filtered.length,
      filters: { tag, version },
      endpoints: filtered,
    };
  }

  @Post('explore/test')
  @ApiOperationEnhanced({
    summary: 'Test API Endpoint',
    description: 'Test any API endpoint through the explorer with custom parameters and headers.',
    tags: ['Explorer', 'Testing'],
  })
  @ApiBody({
    type: ApiExplorerRequest,
    description: 'API test request configuration',
    examples: {
      loginTest: {
        summary: 'Test Login Endpoint',
        value: {
          endpoint: '/auth/login',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Version': 'v1',
          },
          body: {
            email: 'user@fundshield.com',
            password: 'password123',
          },
        },
      },
      getUsersTest: {
        summary: 'Test Get Users Endpoint',
        value: {
          endpoint: '/users',
          method: 'GET',
          headers: {
            'Authorization': 'Bearer your-jwt-token',
            'X-API-Version': 'v1',
          },
          queryParams: {
            page: '1',
            limit: '10',
          },
        },
      },
    },
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Test execution result',
  })
  @ApiErrorResponses()
  async testEndpoint(
    @Body() request: ApiExplorerRequest,
    @Req() req: Request,
  ): Promise<any> {
    try {
      // This is a simulation of the test execution
      // In a real implementation, this would make the actual HTTP request
      const testResult = await this.simulateApiCall(request);
      
      this.logger.log(`API Explorer test executed: ${request.method} ${request.endpoint}`);
      
      return {
        success: true,
        test: {
          endpoint: request.endpoint,
          method: request.method,
          timestamp: new Date().toISOString(),
          requestId: req['requestId'] || 'test_request',
        },
        result: testResult,
      };
    } catch (error) {
      this.logger.error(`API Explorer test failed: ${error.message}`);
      
      return {
        success: false,
        test: {
          endpoint: request.endpoint,
          method: request.method,
          timestamp: new Date().toISOString(),
          error: error.message,
        },
      };
    }
  }

  @Get('explore/examples/:endpoint(*)')
  @ApiOperationEnhanced({
    summary: 'Get Endpoint Examples',
    description: 'Get request/response examples for a specific endpoint.',
    tags: ['Explorer', 'Examples'],
  })
  @ApiParamEnhanced({
    name: 'endpoint',
    description: 'Endpoint path (e.g., auth/login, users)',
    example: 'auth/login',
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Endpoint examples',
  })
  getEndpointExamples(@Param('endpoint') endpoint: string): any {
    // Get examples from Swagger service
    const examples = this.getExamplesForEndpoint(endpoint);
    
    return {
      endpoint: `/${endpoint}`,
      examples,
      generated: new Date().toISOString(),
    };
  }

  @Get('explore/schema/:model')
  @ApiOperationEnhanced({
    summary: 'Get Model Schema',
    description: 'Get the schema definition for a specific data model.',
    tags: ['Explorer', 'Schema'],
  })
  @ApiParamEnhanced({
    name: 'model',
    description: 'Model name (e.g., User, Fund, Transaction)',
    example: 'User',
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Model schema definition',
  })
  getModelSchema(@Param('model') model: string): any {
    const schema = this.swaggerService.getCustomSchema(model);
    
    if (!schema) {
      return {
        error: 'Schema not found',
        model,
        available: Array.from(this.swaggerService['customSchemas'].keys()),
      };
    }

    return {
      model,
      schema: schema.schema,
      examples: schema.examples,
    };
  }

  /**
   * Generate HTML for the API explorer interface
   */
  private generateApiExplorerHtml(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FundShield API Explorer</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; }
          .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 2rem; border-radius: 8px; margin-bottom: 2rem; }
          .card { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 1rem; }
          .card-header { padding: 1rem; border-bottom: 1px solid #e5e7eb; font-weight: 600; }
          .card-body { padding: 1rem; }
          .form-group { margin-bottom: 1rem; }
          label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
          input, select, textarea { width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; }
          button { background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 4px; cursor: pointer; }
          button:hover { background: #2563eb; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
          .response-area { background: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 4px; font-family: monospace; white-space: pre-wrap; }
          .method-tag { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 3px; font-size: 0.75rem; font-weight: 600; }
          .method-get { background: #10b981; color: white; }
          .method-post { background: #3b82f6; color: white; }
          .method-put { background: #f59e0b; color: white; }
          .method-delete { background: #ef4444; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 FundShield API Explorer</h1>
            <p>Interactive API testing and exploration interface</p>
          </div>
          
          <div class="grid">
            <div class="card">
              <div class="card-header">🔧 API Tester</div>
              <div class="card-body">
                <div class="form-group">
                  <label>Endpoint</label>
                  <input type="text" id="endpoint" placeholder="/auth/login" />
                </div>
                <div class="form-group">
                  <label>Method</label>
                  <select id="method">
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Headers (JSON)</label>
                  <textarea id="headers" rows="4" placeholder='{"Content-Type": "application/json", "X-API-Version": "v1"}'></textarea>
                </div>
                <div class="form-group">
                  <label>Body (JSON)</label>
                  <textarea id="body" rows="6" placeholder='{"email": "user@example.com", "password": "password"}'></textarea>
                </div>
                <button onclick="testEndpoint()">🚀 Test Endpoint</button>
              </div>
            </div>
            
            <div class="card">
              <div class="card-header">📄 Response</div>
              <div class="card-body">
                <div id="response" class="response-area">Click "Test Endpoint" to see the response...</div>
              </div>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header">📚 Available Endpoints</div>
            <div class="card-body" id="endpoints">
              Loading endpoints...
            </div>
          </div>
        </div>
        
        <script>
          async function loadEndpoints() {
            try {
              const response = await fetch('/api/gateway/explore/endpoints');
              const data = await response.json();
              const container = document.getElementById('endpoints');
              
              container.innerHTML = data.endpoints.map(endpoint => \`
                <div style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 4px;">
                  <div style="margin-bottom: 0.5rem;">
                    <span class="method-tag method-\${endpoint.method.toLowerCase()}">\${endpoint.method}</span>
                    <strong style="margin-left: 0.5rem;">\${endpoint.path}</strong>
                  </div>
                  <p style="color: #6b7280; margin-bottom: 0.5rem;">\${endpoint.description}</p>
                  <button onclick="loadExample('\${endpoint.path}', '\${endpoint.method}')" style="background: #6b7280; font-size: 0.75rem; padding: 0.25rem 0.5rem;">Load Example</button>
                </div>
              \`).join('');
            } catch (error) {
              document.getElementById('endpoints').innerHTML = 'Error loading endpoints: ' + error.message;
            }
          }
          
          function loadExample(path, method) {
            document.getElementById('endpoint').value = path;
            document.getElementById('method').value = method;
            
            // Load example data based on endpoint
            if (path === '/auth/login') {
              document.getElementById('headers').value = JSON.stringify({"Content-Type": "application/json", "X-API-Version": "v1"}, null, 2);
              document.getElementById('body').value = JSON.stringify({"email": "user@fundshield.com", "password": "password123"}, null, 2);
            } else if (path === '/users') {
              document.getElementById('headers').value = JSON.stringify({"Authorization": "Bearer your-jwt-token", "X-API-Version": "v1"}, null, 2);
              document.getElementById('body').value = '';
            }
          }
          
          async function testEndpoint() {
            const endpoint = document.getElementById('endpoint').value;
            const method = document.getElementById('method').value;
            const headers = document.getElementById('headers').value;
            const body = document.getElementById('body').value;
            
            try {
              const requestData = {
                endpoint,
                method,
                headers: headers ? JSON.parse(headers) : {},
                body: body ? JSON.parse(body) : undefined
              };
              
              const response = await fetch('/api/gateway/explore/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
              });
              
              const result = await response.json();
              document.getElementById('response').textContent = JSON.stringify(result, null, 2);
            } catch (error) {
              document.getElementById('response').textContent = 'Error: ' + error.message;
            }
          }
          
          // Load endpoints on page load
          loadEndpoints();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Simulate API call for testing
   */
  private async simulateApiCall(request: ApiExplorerRequest): Promise<any> {
    // This simulates different API responses based on the endpoint
    const { endpoint, method } = request;
    
    if (endpoint === '/auth/login' && method === 'POST') {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        data: {
          success: true,
          data: {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.simulated.token',
            user: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'user@fundshield.com',
              role: 'user',
            },
          },
          metadata: {
            version: 'v1',
            timestamp: new Date().toISOString(),
            responseTime: 45,
          },
        },
      };
    }
    
    if (endpoint === '/users' && method === 'GET') {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        data: {
          success: true,
          data: [
            {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'user1@fundshield.com',
              firstName: 'John',
              lastName: 'Doe',
            },
            {
              id: '456e7890-e89b-12d3-a456-426614174001',
              email: 'user2@fundshield.com',
              firstName: 'Jane',
              lastName: 'Smith',
            },
          ],
          metadata: {
            version: 'v1',
            timestamp: new Date().toISOString(),
            responseTime: 23,
            pagination: {
              page: 1,
              limit: 10,
              total: 50,
              totalPages: 5,
            },
          },
        },
      };
    }
    
    // Default simulation for other endpoints
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      data: {
        success: true,
        message: `Simulated response for ${method} ${endpoint}`,
        metadata: {
          version: 'v1',
          timestamp: new Date().toISOString(),
          responseTime: Math.floor(Math.random() * 100) + 10,
        },
      },
    };
  }

  /**
   * Get examples for a specific endpoint
   */
  private getExamplesForEndpoint(endpoint: string): any[] {
    const examples = this.swaggerService.getCustomExamples(endpoint);
    
    if (examples) {
      return examples;
    }
    
    // Return default examples based on endpoint pattern
    if (endpoint.includes('auth/login')) {
      return [
        {
          summary: 'Standard Login',
          description: 'Login with email and password',
          value: {
            email: 'user@fundshield.com',
            password: 'SecurePassword123!',
          },
        },
      ];
    }
    
    return [
      {
        summary: 'Default Example',
        description: 'Default example for this endpoint',
        value: { message: 'Example data' },
      },
    ];
  }
}