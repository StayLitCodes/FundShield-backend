import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { ApiGatewayConfig } from '../config/api-gateway.config';

interface RateLimitInfo {
  key: string;
  limit: number;
  current: number;
  reset: Date;
  remaining: number;
}

interface RateLimitRule {
  name: string;
  limit: number;
  window: number; // in milliseconds
  skipIf?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

@Injectable()
export class AdvancedRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(AdvancedRateLimitGuard.name);
  private readonly config: ApiGatewayConfig;
  private readonly limitStore = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly rules = new Map<string, RateLimitRule>();

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.config = this.configService.get<ApiGatewayConfig>('apiGateway');
    this.initializeRules();
    this.startCleanupTimer();
  }

  /**
   * Initialize rate limiting rules
   */
  private initializeRules(): void {
    // Global rate limit
    this.rules.set('global', {
      name: 'global',
      limit: this.config.rateLimit.global.limit,
      window: this.config.rateLimit.global.ttl,
      keyGenerator: req => this.getClientKey(req),
    });

    // Authentication endpoints - stricter limits
    this.rules.set('auth', {
      name: 'auth',
      limit: 5,
      window: 60000, // 1 minute
      keyGenerator: req => `auth:${this.getClientKey(req)}`,
      skipIf: req => !req.path.startsWith('/auth'),
      message: 'Too many authentication attempts. Please try again later.',
    });

    // Heavy operations - more restrictive
    this.rules.set('heavy', {
      name: 'heavy',
      limit: 10,
      window: 300000, // 5 minutes
      keyGenerator: req => `heavy:${this.getClientKey(req)}`,
      skipIf: req => !this.isHeavyOperation(req),
      message: 'Rate limit exceeded for heavy operations.',
    });

    // Per-endpoint specific limits
    Object.entries(this.config.rateLimit.perEndpoint).forEach(
      ([endpoint, config]) => {
        this.rules.set(`endpoint:${endpoint}`, {
          name: `endpoint:${endpoint}`,
          limit: config.limit,
          window: config.ttl,
          keyGenerator: req => `endpoint:${endpoint}:${this.getClientKey(req)}`,
          skipIf: req => !req.path.includes(endpoint),
        });
      },
    );

    this.logger.log(`Initialized ${this.rules.size} rate limiting rules`);
  }

  /**
   * Check if request passes rate limit checks
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Check if rate limiting is enabled
    if (!this.config.rateLimit.global.limit) {
      return true;
    }

    // Apply all applicable rules
    const applicableRules = Array.from(this.rules.values()).filter(
      rule => !rule.skipIf || !rule.skipIf(request),
    );

    for (const rule of applicableRules) {
      const rateLimitInfo = await this.checkRateLimit(request, rule);

      // Add rate limit headers
      this.addRateLimitHeaders(response, rateLimitInfo, rule);

      if (rateLimitInfo.current > rateLimitInfo.limit) {
        this.logger.warn(
          `Rate limit exceeded for ${rule.name}: ${rateLimitInfo.current}/${rateLimitInfo.limit} (${rateLimitInfo.key})`,
        );

        this.handleRateLimitExceeded(response, rule, rateLimitInfo);
        return false;
      }
    }

    return true;
  }

  /**
   * Check rate limit for a specific rule
   */
  private async checkRateLimit(
    request: Request,
    rule: RateLimitRule,
  ): Promise<RateLimitInfo> {
    const key = rule.keyGenerator(request);
    const now = Date.now();
    const windowStart = now - rule.window;

    // Get or create rate limit entry
    let entry = this.limitStore.get(key);

    if (!entry || entry.resetTime <= now) {
      // Create new or reset expired entry
      entry = {
        count: 0,
        resetTime: now + rule.window,
      };
    }

    // Increment counter
    entry.count++;
    this.limitStore.set(key, entry);

    return {
      key,
      limit: rule.limit,
      current: entry.count,
      reset: new Date(entry.resetTime),
      remaining: Math.max(0, rule.limit - entry.count),
    };
  }

  /**
   * Add rate limit headers to response
   */
  private addRateLimitHeaders(
    response: Response,
    info: RateLimitInfo,
    rule: RateLimitRule,
  ): void {
    response.setHeader('X-RateLimit-Limit', info.limit);
    response.setHeader('X-RateLimit-Remaining', info.remaining);
    response.setHeader(
      'X-RateLimit-Reset',
      Math.ceil(info.reset.getTime() / 1000),
    );
    response.setHeader('X-RateLimit-Window', Math.ceil(rule.window / 1000));
    response.setHeader('X-RateLimit-Rule', rule.name);
  }

  /**
   * Handle rate limit exceeded
   */
  private handleRateLimitExceeded(
    response: Response,
    rule: RateLimitRule,
    info: RateLimitInfo,
  ): void {
    const retryAfter = Math.ceil((info.reset.getTime() - Date.now()) / 1000);

    response.setHeader('Retry-After', retryAfter);

    throw new HttpException(
      {
        error: 'Rate Limit Exceeded',
        message: rule.message || 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          rule: rule.name,
          limit: info.limit,
          current: info.current,
          retryAfter,
          resetTime: info.reset.toISOString(),
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /**
   * Generate client key for rate limiting
   */
  private getClientKey(request: Request): string {
    // Priority order: API key, user ID, IP address
    const apiKey = request.headers['x-api-key'] as string;
    if (apiKey) {
      return `apikey:${apiKey}`;
    }

    const userId = (request as any)['user']?.id;
    if (userId) {
      return `user:${userId}`;
    }

    const ip = this.getClientIP(request);
    return `ip:${ip}`;
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: Request): string {
    return (
      (request.headers['cf-connecting-ip'] as string) ||
      (request.headers['x-forwarded-for'] as string) ||
      (request.headers['x-real-ip'] as string) ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Check if operation is considered heavy
   */
  private isHeavyOperation(request: Request): boolean {
    const heavyPaths = [
      '/analytics/reports',
      '/export',
      '/bulk',
      '/import',
      '/migrate',
    ];

    return heavyPaths.some(path => request.path.includes(path));
  }

  /**
   * Start cleanup timer to remove expired entries
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.limitStore.entries()) {
        if (entry.resetTime <= now) {
          this.limitStore.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
      }
    }, 60000); // Cleanup every minute
  }

  /**
   * Get current rate limit status for a key
   */
  getRateLimitStatus(key: string): RateLimitInfo | null {
    const entry = this.limitStore.get(key);
    if (!entry) {
      return null;
    }

    const rule = this.rules.get('global'); // Default to global rule
    if (!rule) {
      return null;
    }

    return {
      key,
      limit: rule.limit,
      current: entry.count,
      reset: new Date(entry.resetTime),
      remaining: Math.max(0, rule.limit - entry.count),
    };
  }

  /**
   * Add custom rate limit rule
   */
  addRule(rule: RateLimitRule): void {
    this.rules.set(rule.name, rule);
    this.logger.log(`Added custom rate limit rule: ${rule.name}`);
  }

  /**
   * Remove rate limit rule
   */
  removeRule(name: string): void {
    this.rules.delete(name);
    this.logger.log(`Removed rate limit rule: ${name}`);
  }

  /**
   * Get all rate limit rules
   */
  getRules(): RateLimitRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Reset rate limit for a specific key
   */
  resetRateLimit(key: string): void {
    this.limitStore.delete(key);
    this.logger.log(`Reset rate limit for key: ${key}`);
  }

  /**
   * Get rate limit statistics
   */
  getStatistics(): any {
    const now = Date.now();
    const active = Array.from(this.limitStore.entries()).filter(
      ([, entry]) => entry.resetTime > now,
    );

    return {
      totalKeys: this.limitStore.size,
      activeKeys: active.length,
      rules: this.rules.size,
      topKeys: active
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10)
        .map(([key, entry]) => ({
          key,
          count: entry.count,
          resetTime: new Date(entry.resetTime).toISOString(),
        })),
    };
  }
}
