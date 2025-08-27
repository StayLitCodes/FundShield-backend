import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiGatewayConfig } from '../config/api-gateway.config';

@Injectable()
export class SecurityHeadersInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SecurityHeadersInterceptor.name);
  private readonly config: ApiGatewayConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<ApiGatewayConfig>('apiGateway');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Add security headers
    this.addSecurityHeaders(response);

    // Handle CORS
    this.handleCORS(request, response);

    return next.handle().pipe(
      tap(() => {
        // Add response-time header
        const startTime = request['gatewayStartTime'] || Date.now();
        const responseTime = Date.now() - startTime;
        response.setHeader('X-Response-Time', `${responseTime}ms`);
      }),
    );
  }

  /**
   * Add comprehensive security headers
   */
  private addSecurityHeaders(response: Response): void {
    const { security } = this.config;

    // Content Security Policy
    if (security.helmet.contentSecurityPolicy) {
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';",
      );
    }

    // X-Frame-Options
    if (security.helmet.frameguard) {
      response.setHeader('X-Frame-Options', 'DENY');
    }

    // X-Content-Type-Options
    if (security.helmet.noSniff) {
      response.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-XSS-Protection
    if (security.helmet.xssFilter) {
      response.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Referrer Policy
    if (security.helmet.referrerPolicy) {
      response.setHeader('Referrer-Policy', 'no-referrer');
    }

    // Strict Transport Security (HTTPS only)
    if (security.helmet.hsts && process.env.NODE_ENV === 'production') {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }

    // Cross-Origin Embedder Policy
    if (security.helmet.crossOriginEmbedderPolicy) {
      response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    // Cross-Origin Opener Policy
    if (security.helmet.crossOriginOpenerPolicy) {
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    }

    // Cross-Origin Resource Policy
    if (security.helmet.crossOriginResourcePolicy) {
      response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }

    // Custom security headers
    Object.entries(security.customHeaders).forEach(([key, value]) => {
      response.setHeader(key, value);
    });

    // Remove server information
    if (security.helmet.hidePoweredBy) {
      response.removeHeader('X-Powered-By');
    }
  }

  /**
   * Handle CORS configuration
   */
  private handleCORS(request: Request, response: Response): void {
    const { cors } = this.config;

    const origin = request.headers.origin;
    let allowedOrigins: string[] = [];

    if (Array.isArray(cors.origin)) {
      allowedOrigins = cors.origin;
    } else if (cors.origin !== true) {
      allowedOrigins = [String(cors.origin)];
    }

    // Set Access-Control-Allow-Origin
    if (cors.origin === true) {
      response.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin && allowedOrigins.includes(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
    }

    // Set other CORS headers
    response.setHeader('Access-Control-Allow-Methods', cors.methods.join(', '));
    response.setHeader(
      'Access-Control-Allow-Headers',
      cors.allowedHeaders.join(', '),
    );

    if (cors.credentials) {
      response.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    response.setHeader('Access-Control-Max-Age', cors.maxAge.toString());

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }
  }
}
