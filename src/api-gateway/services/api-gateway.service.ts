import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ApiGatewayConfig } from '../config/api-gateway.config';

export interface RouteConfig {
  path: string;
  method: string;
  version: string;
  rateLimit?: {
    ttl: number;
    limit: number;
  };
  transform?: {
    request?: boolean;
    response?: boolean;
  };
  analytics?: boolean;
}

export interface GatewayMetrics {
  totalRequests: number;
  activeRequests: number;
  averageResponseTime: number;
  errorRate: number;
  rateLimitHits: number;
  lastUpdated: Date;
}

@Injectable()
export class ApiGatewayService {
  private readonly logger = new Logger(ApiGatewayService.name);
  private readonly config: ApiGatewayConfig;
  private readonly routes = new Map<string, RouteConfig>();
  private readonly metrics: GatewayMetrics = {
    totalRequests: 0,
    activeRequests: 0,
    averageResponseTime: 0,
    errorRate: 0,
    rateLimitHits: 0,
    lastUpdated: new Date(),
  };

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<ApiGatewayConfig>('apiGateway');
    this.initializeRoutes();
  }

  /**
   * Initialize default routes and their configurations
   */
  private initializeRoutes(): void {
    const defaultRoutes: RouteConfig[] = [
      {
        path: '/auth/login',
        method: 'POST',
        version: 'v1',
        rateLimit: { ttl: 60000, limit: 5 },
        analytics: true,
      },
      {
        path: '/auth/register',
        method: 'POST',
        version: 'v1',
        rateLimit: { ttl: 300000, limit: 3 },
        analytics: true,
      },
      {
        path: '/users',
        method: 'GET',
        version: 'v1',
        transform: { response: true },
        analytics: true,
      },
      {
        path: '/analytics',
        method: 'GET',
        version: 'v1',
        rateLimit: { ttl: 60000, limit: 200 },
        analytics: false,
      },
    ];

    defaultRoutes.forEach(route => {
      const key = `${route.method}:${route.path}:${route.version}`;
      this.routes.set(key, route);
    });

    this.logger.log(`Initialized ${this.routes.size} gateway routes`);
  }

  /**
   * Register a new route with the gateway
   */
  registerRoute(config: RouteConfig): void {
    const key = `${config.method}:${config.path}:${config.version}`;
    this.routes.set(key, config);
    this.logger.log(`Registered route: ${key}`);
  }

  /**
   * Get route configuration for a specific request
   */
  getRouteConfig(method: string, path: string, version: string): RouteConfig | undefined {
    const key = `${method}:${path}:${version}`;
    return this.routes.get(key);
  }

  /**
   * Process an incoming request through the gateway
   */
  async processRequest(req: Request, res: Response, next: Function): Promise<void> {
    const startTime = Date.now();
    this.metrics.activeRequests++;
    this.metrics.totalRequests++;

    try {
      // Extract version from request
      const version = this.extractVersion(req);
      const routeConfig = this.getRouteConfig(req.method, req.path, version);

      // Add gateway headers
      this.addGatewayHeaders(res, version);

      // Set route config in request for downstream middleware
      req['routeConfig'] = routeConfig;
      req['gatewayStartTime'] = startTime;

      next();
    } catch (error) {
      this.logger.error(`Gateway processing error: ${error.message}`, error.stack);
      this.metrics.errorRate++;
      next(error);
    } finally {
      this.metrics.activeRequests--;
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime);
    }
  }

  /**
   * Extract version from request
   */
  private extractVersion(req: Request): string {
    const { versioning } = this.config;

    switch (versioning.type) {
      case 'uri':
        const pathVersion = req.path.match(/\/v(\d+)/)?.[1];
        return pathVersion ? `v${pathVersion}` : versioning.defaultVersion;
        
      case 'header':
        return req.headers[versioning.header?.toLowerCase()] as string || versioning.defaultVersion;
        
      case 'custom':
        return versioning.extractor ? versioning.extractor(req) : versioning.defaultVersion;
        
      default:
        return versioning.defaultVersion;
    }
  }

  /**
   * Add gateway-specific headers to response
   */
  private addGatewayHeaders(res: Response, version: string): void {
    const { customHeaders } = this.config.security;

    // Add standard gateway headers
    res.setHeader('X-API-Gateway', 'FundShield-Gateway/1.0');
    res.setHeader('X-API-Version', version);
    res.setHeader('X-Request-ID', this.generateRequestId());

    // Add custom security headers
    Object.entries(customHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update gateway metrics
   */
  private updateMetrics(responseTime: number): void {
    // Update average response time using exponential moving average
    this.metrics.averageResponseTime = 
      this.metrics.averageResponseTime * 0.9 + responseTime * 0.1;
    
    this.metrics.lastUpdated = new Date();
  }

  /**
   * Get current gateway metrics
   */
  getMetrics(): GatewayMetrics {
    return { ...this.metrics };
  }

  /**
   * Get gateway configuration
   */
  getConfig(): ApiGatewayConfig {
    return this.config;
  }

  /**
   * Get all registered routes
   */
  getRoutes(): RouteConfig[] {
    return Array.from(this.routes.values());
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics.totalRequests = 0;
    this.metrics.activeRequests = 0;
    this.metrics.averageResponseTime = 0;
    this.metrics.errorRate = 0;
    this.metrics.rateLimitHits = 0;
    this.metrics.lastUpdated = new Date();
  }

  /**
   * Validate request against gateway rules
   */
  validateRequest(req: Request): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate API version
    const version = this.extractVersion(req);
    if (!version || !version.match(/^v\d+$/)) {
      errors.push('Invalid API version format');
    }

    // Validate required headers
    const requiredHeaders = ['user-agent', 'accept'];
    requiredHeaders.forEach(header => {
      if (!req.headers[header]) {
        errors.push(`Missing required header: ${header}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Handle rate limit exceeded
   */
  handleRateLimitExceeded(req: Request, res: Response): void {
    this.metrics.rateLimitHits++;
    
    res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: 'Too many requests, please try again later',
      retryAfter: 60,
      requestId: res.getHeader('X-Request-ID'),
    });
  }
}