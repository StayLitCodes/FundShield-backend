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
import {
  ApiGatewayService,
  GatewayMetrics,
} from '../services/api-gateway.service';
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
    description:
      'Check the health and status of the API Gateway including metrics and configuration.',
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
    description:
      'Retrieve detailed metrics about API Gateway performance and usage.',
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
    description:
      'List all routes registered with the API Gateway including their configurations.',
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

  @Get('dashboard')
  @ApiOperationEnhanced({
    summary: 'API Usage Dashboard',
    description:
      'Interactive dashboard for monitoring API usage, performance metrics, and system health with real-time updates.',
    tags: ['Dashboard', 'Monitoring'],
  })
  @ApiResponseEnhanced({
    status: 200,
    description: 'Dashboard interface HTML',
  })
  getDashboard(@Res() res: Response): void {
    const dashboardHtml = this.generateDashboardHtml();
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboardHtml);
  }

  @Get('explore')
  @ApiOperationEnhanced({
    summary: 'API Explorer Interface',
    description:
      'Interactive API explorer for testing endpoints with real-time examples and responses.',
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
        responses: [
          { status: 200, description: 'Users retrieved successfully' },
        ],
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
        endpoint.path.toLowerCase().includes(tag.toLowerCase()),
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
    description:
      'Test any API endpoint through the explorer with custom parameters and headers.',
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
            Authorization: 'Bearer your-jwt-token',
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

      this.logger.log(
        `API Explorer test executed: ${request.method} ${request.endpoint}`,
      );

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
   * Generate HTML for the dashboard interface
   */
  private generateDashboardHtml(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FundShield API Dashboard</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; color: #333; }
          .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 2rem; border-radius: 8px; margin-bottom: 2rem; position: relative; overflow: hidden; }
          .header::before { content: ''; position: absolute; top: -50%; right: -50%; width: 100%; height: 100%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); }
          .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
          .header p { font-size: 1.1rem; opacity: 0.9; }
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
          .stat-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-left: 4px solid #3b82f6; transition: transform 0.2s; }
          .stat-card:hover { transform: translateY(-2px); }
          .stat-card.error { border-left-color: #ef4444; }
          .stat-card.warning { border-left-color: #f59e0b; }
          .stat-card.success { border-left-color: #10b981; }
          .stat-value { font-size: 2.5rem; font-weight: bold; color: #1e3a8a; margin-bottom: 0.5rem; }
          .stat-label { color: #6b7280; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; }
          .stat-change { font-size: 0.8rem; margin-top: 0.5rem; }
          .stat-change.positive { color: #10b981; }
          .stat-change.negative { color: #ef4444; }
          .charts-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; margin-bottom: 2rem; }
          .chart-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .chart-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; color: #1e3a8a; }
          .chart-container { position: relative; height: 300px; }
          .tables-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
          .table-card { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
          .table-header { background: #f8fafc; padding: 1rem; font-weight: 600; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; }
          .table { width: 100%; }
          .table th, .table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
          .table th { background: #f8fafc; font-weight: 600; color: #374151; }
          .table tbody tr:hover { background: #f9fafb; }
          .status-indicator { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
          .status-healthy { background-color: #10b981; }
          .status-warning { background-color: #f59e0b; }
          .status-error { background-color: #ef4444; }
          .refresh-btn { background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.9rem; }
          .refresh-btn:hover { background: #2563eb; }
          .alerts-panel { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 2rem; }
          .alert { padding: 1rem; border-left: 4px solid #3b82f6; margin-bottom: 1px; }
          .alert.error { border-left-color: #ef4444; background: #fef2f2; }
          .alert.warning { border-left-color: #f59e0b; background: #fffbeb; }
          .alert.info { border-left-color: #3b82f6; background: #eff6ff; }
          .alert-title { font-weight: 600; margin-bottom: 0.25rem; }
          .alert-time { font-size: 0.8rem; color: #6b7280; }
          .loading { text-align: center; padding: 2rem; color: #6b7280; }
          .error-message { background: #fef2f2; color: #dc2626; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
          @media (max-width: 768px) {
            .charts-grid, .tables-grid { grid-template-columns: 1fr; }
            .stats-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
            .header h1 { font-size: 2rem; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 FundShield API Dashboard</h1>
            <p>Real-time monitoring and analytics for your API gateway</p>
            <button class="refresh-btn" onclick="refreshDashboard()" style="position: absolute; top: 2rem; right: 2rem;">🔄 Refresh</button>
          </div>
          
          <div id="alerts-container" class="alerts-panel" style="display: none;">
            <div class="table-header">System Alerts</div>
            <div id="alerts-list"></div>
          </div>
          
          <div class="stats-grid" id="stats-grid">
            <div class="loading">Loading dashboard metrics...</div>
          </div>
          
          <div class="charts-grid">
            <div class="chart-card">
              <div class="chart-title">📈 Request Volume (Last 24 Hours)</div>
              <div class="chart-container">
                <canvas id="requestsChart"></canvas>
              </div>
            </div>
            <div class="chart-card">
              <div class="chart-title">🔄 API Version Usage</div>
              <div class="chart-container">
                <canvas id="versionsChart"></canvas>
              </div>
            </div>
          </div>
          
          <div class="charts-grid">
            <div class="chart-card">
              <div class="chart-title">⚡ Response Time Trends</div>
              <div class="chart-container">
                <canvas id="responseTimeChart"></canvas>
              </div>
            </div>
            <div class="chart-card">
              <div class="chart-title">💾 System Resources</div>
              <div class="chart-container">
                <canvas id="resourcesChart"></canvas>
              </div>
            </div>
          </div>
          
          <div class="tables-grid">
            <div class="table-card">
              <div class="table-header">🎯 Top Endpoints</div>
              <div style="max-height: 400px; overflow-y: auto;">
                <table class="table" id="endpoints-table">
                  <thead>
                    <tr>
                      <th>Endpoint</th>
                      <th>Requests</th>
                      <th>Avg Response</th>
                      <th>Success Rate</th>
                    </tr>
                  </thead>
                  <tbody id="endpoints-tbody">
                    <tr><td colspan="4" class="loading">Loading endpoints...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="table-card">
              <div class="table-header">⚠️ Recent Errors</div>
              <div style="max-height: 400px; overflow-y: auto;">
                <table class="table" id="errors-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Endpoint</th>
                      <th>Status</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody id="errors-tbody">
                    <tr><td colspan="4" class="loading">Loading errors...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        
        <script>
          let requestsChart, versionsChart, responseTimeChart, resourcesChart;
          let eventSource;
          
          // Initialize dashboard
          document.addEventListener('DOMContentLoaded', function() {
            initializeDashboard();
            setupRealtimeUpdates();
          });
          
          async function initializeDashboard() {
            try {
              await loadDashboardData();
              initializeCharts();
            } catch (error) {
              showError('Failed to load dashboard data: ' + error.message);
            }
          }
          
          async function loadDashboardData() {
            const [metricsResponse, alertsResponse] = await Promise.all([
              fetch('/api/dashboard/metrics'),
              fetch('/api/dashboard/alerts')
            ]);
            
            if (!metricsResponse.ok) {
              throw new Error('Failed to load metrics');
            }
            
            const metricsData = await metricsResponse.json();
            const alertsData = alertsResponse.ok ? await alertsResponse.json() : { data: [] };
            
            updateStatsCards(metricsData.data);
            updateEndpointsTable(metricsData.data.endpoints);
            updateErrorsTable(metricsData.data.errors);
            updateAlerts(alertsData.data);
            updateCharts(metricsData.data);
          }
          
          function updateStatsCards(data) {
            const statsGrid = document.getElementById('stats-grid');
            statsGrid.innerHTML = \`
              <div class="stat-card success">
                <div class="stat-value">\${data.overview.totalRequests.toLocaleString()}</div>
                <div class="stat-label">Total Requests</div>
                <div class="stat-change positive">+\${data.realtime.requestsPerMinute}/min</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">\${data.overview.averageResponseTime}ms</div>
                <div class="stat-label">Avg Response Time</div>
                <div class="stat-change \${data.overview.averageResponseTime < 500 ? 'positive' : 'negative'}">\${data.overview.averageResponseTime < 500 ? 'Good' : 'Slow'}</div>
              </div>
              <div class="stat-card \${data.overview.errorRate > 0.05 ? 'error' : 'success'}">
                <div class="stat-value">\${(data.overview.errorRate * 100).toFixed(2)}%</div>
                <div class="stat-label">Error Rate</div>
                <div class="stat-change \${data.overview.errorRate < 0.01 ? 'positive' : 'negative'}">\${data.overview.errorRate < 0.01 ? 'Excellent' : 'Needs Attention'}</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">\${data.realtime.activeUsers}</div>
                <div class="stat-label">Active Users</div>
                <div class="stat-change positive">Online Now</div>
              </div>
              <div class="stat-card \${data.realtime.memoryUsage > 80 ? 'warning' : 'success'}">
                <div class="stat-value">\${data.realtime.memoryUsage}%</div>
                <div class="stat-label">Memory Usage</div>
                <div class="stat-change \${data.realtime.memoryUsage < 70 ? 'positive' : 'negative'}">\${data.realtime.memoryUsage < 70 ? 'Normal' : 'High'}</div>
              </div>
              <div class="stat-card \${data.realtime.cpuUsage > 80 ? 'warning' : 'success'}">
                <div class="stat-value">\${data.realtime.cpuUsage}%</div>
                <div class="stat-label">CPU Usage</div>
                <div class="stat-change \${data.realtime.cpuUsage < 70 ? 'positive' : 'negative'}">\${data.realtime.cpuUsage < 70 ? 'Normal' : 'High'}</div>
              </div>
            \`;
          }
          
          function updateEndpointsTable(endpoints) {
            const tbody = document.getElementById('endpoints-tbody');
            tbody.innerHTML = endpoints.slice(0, 10).map(endpoint => \`
              <tr>
                <td><strong>\${endpoint.method}</strong> \${endpoint.path}</td>
                <td>\${endpoint.requests.toLocaleString()}</td>
                <td>\${endpoint.averageResponseTime}ms</td>
                <td>
                  <span class="status-indicator status-\${endpoint.successRate > 95 ? 'healthy' : endpoint.successRate > 85 ? 'warning' : 'error'}"></span>
                  \${endpoint.successRate}%
                </td>
              </tr>
            \`).join('');
          }
          
          function updateErrorsTable(errors) {
            const tbody = document.getElementById('errors-tbody');
            if (errors.length === 0) {
              tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #10b981;">✅ No recent errors</td></tr>';
              return;
            }
            
            tbody.innerHTML = errors.slice(0, 10).map(error => \`
              <tr>
                <td>\${new Date(error.timestamp).toLocaleTimeString()}</td>
                <td>\${error.method} \${error.path}</td>
                <td><span class="status-indicator status-error"></span>\${error.statusCode}</td>
                <td>\${error.message.substring(0, 50)}...</td>
              </tr>
            \`).join('');
          }
          
          function updateAlerts(alerts) {
            const container = document.getElementById('alerts-container');
            const list = document.getElementById('alerts-list');
            
            if (alerts.length === 0) {
              container.style.display = 'none';
              return;
            }
            
            container.style.display = 'block';
            list.innerHTML = alerts.slice(0, 5).map(alert => \`
              <div class="alert \${alert.type}">
                <div class="alert-title">\${alert.title}</div>
                <div>\${alert.message}</div>
                <div class="alert-time">\${new Date(alert.timestamp).toLocaleString()}</div>
              </div>
            \`).join('');
          }
          
          function initializeCharts() {
            // Requests Chart
            const requestsCtx = document.getElementById('requestsChart').getContext('2d');
            requestsChart = new Chart(requestsCtx, {
              type: 'line',
              data: {
                labels: [],
                datasets: [{
                  label: 'Requests per Hour',
                  data: [],
                  borderColor: '#3b82f6',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  tension: 0.4
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { beginAtZero: true }
                }
              }
            });
            
            // Versions Chart
            const versionsCtx = document.getElementById('versionsChart').getContext('2d');
            versionsChart = new Chart(versionsCtx, {
              type: 'doughnut',
              data: {
                labels: [],
                datasets: [{
                  data: [],
                  backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false
              }
            });
            
            // Response Time Chart
            const responseTimeCtx = document.getElementById('responseTimeChart').getContext('2d');
            responseTimeChart = new Chart(responseTimeCtx, {
              type: 'line',
              data: {
                labels: [],
                datasets: [{
                  label: 'Response Time (ms)',
                  data: [],
                  borderColor: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  tension: 0.4
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { beginAtZero: true }
                }
              }
            });
            
            // Resources Chart
            const resourcesCtx = document.getElementById('resourcesChart').getContext('2d');
            resourcesChart = new Chart(resourcesCtx, {
              type: 'line',
              data: {
                labels: [],
                datasets: [
                  {
                    label: 'Memory %',
                    data: [],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4
                  },
                  {
                    label: 'CPU %',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4
                  }
                ]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { 
                    beginAtZero: true,
                    max: 100
                  }
                }
              }
            });
          }
          
          function updateCharts(data) {
            // Update versions chart
            if (data.versions && data.versions.length > 0) {
              versionsChart.data.labels = data.versions.map(v => v.version);
              versionsChart.data.datasets[0].data = data.versions.map(v => v.usage);
              versionsChart.update();
            }
            
            // Update performance charts with sample data
            const now = new Date();
            const last24Hours = [];
            for (let i = 23; i >= 0; i--) {
              const time = new Date(now - i * 60 * 60 * 1000);
              last24Hours.push(time.getHours() + ':00');
            }
            
            // Sample data for requests
            const requestData = Array.from({length: 24}, () => Math.floor(Math.random() * 100) + 50);
            requestsChart.data.labels = last24Hours;
            requestsChart.data.datasets[0].data = requestData;
            requestsChart.update();
            
            // Sample data for response times
            const responseData = Array.from({length: 24}, () => Math.floor(Math.random() * 200) + 100);
            responseTimeChart.data.labels = last24Hours;
            responseTimeChart.data.datasets[0].data = responseData;
            responseTimeChart.update();
            
            // Real resource data
            const resourceLabels = last24Hours.slice(-12); // Last 12 hours
            const memoryData = Array.from({length: 12}, () => data.realtime.memoryUsage + (Math.random() - 0.5) * 10);
            const cpuData = Array.from({length: 12}, () => data.realtime.cpuUsage + (Math.random() - 0.5) * 15);
            
            resourcesChart.data.labels = resourceLabels;
            resourcesChart.data.datasets[0].data = memoryData;
            resourcesChart.data.datasets[1].data = cpuData;
            resourcesChart.update();
          }
          
          function setupRealtimeUpdates() {
            // Use Server-Sent Events for real-time updates
            eventSource = new EventSource('/api/dashboard/realtime/stream');
            
            eventSource.onmessage = function(event) {
              try {
                const data = JSON.parse(event.data);
                updateRealtimeData(data);
              } catch (error) {
                console.error('Error parsing SSE data:', error);
              }
            };
            
            eventSource.onerror = function(error) {
              console.error('SSE connection error:', error);
              // Fallback to polling
              setTimeout(setupPolling, 5000);
            };
          }
          
          function setupPolling() {
            setInterval(async () => {
              try {
                const response = await fetch('/api/dashboard/realtime');
                if (response.ok) {
                  const data = await response.json();
                  updateRealtimeData(data);
                }
              } catch (error) {
                console.error('Polling error:', error);
              }
            }, 10000); // Poll every 10 seconds
          }
          
          function updateRealtimeData(data) {
            // Update the realtime metrics in the stats cards
            const statsCards = document.querySelectorAll('.stat-card');
            if (data.realtime && statsCards.length >= 6) {
              // Update active users
              statsCards[3].querySelector('.stat-value').textContent = data.realtime.activeUsers;
              
              // Update memory usage
              statsCards[4].querySelector('.stat-value').textContent = data.realtime.memoryUsage + '%';
              
              // Update CPU usage
              statsCards[5].querySelector('.stat-value').textContent = data.realtime.cpuUsage + '%';
            }
          }
          
          async function refreshDashboard() {
            const refreshBtn = document.querySelector('.refresh-btn');
            const originalText = refreshBtn.textContent;
            refreshBtn.textContent = '🔄 Refreshing...';
            refreshBtn.disabled = true;
            
            try {
              await loadDashboardData();
            } catch (error) {
              showError('Failed to refresh dashboard: ' + error.message);
            } finally {
              refreshBtn.textContent = originalText;
              refreshBtn.disabled = false;
            }
          }
          
          function showError(message) {
            const container = document.querySelector('.container');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            container.insertBefore(errorDiv, container.firstChild);
            
            setTimeout(() => {
              errorDiv.remove();
            }, 5000);
          }
          
          // Cleanup on page unload
          window.addEventListener('beforeunload', function() {
            if (eventSource) {
              eventSource.close();
            }
          });
        </script>
      </body>
      </html>
    `;
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
