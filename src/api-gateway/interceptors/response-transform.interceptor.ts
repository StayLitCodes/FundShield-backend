import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiGatewayConfig } from '../config/api-gateway.config';
import { VersioningService } from '../services/versioning.service';

export interface StandardApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    version: string;
    timestamp: string;
    requestId: string;
    responseTime: number;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseTransformInterceptor.name);
  private readonly config: ApiGatewayConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly versioningService: VersioningService,
  ) {
    this.config = this.configService.get<ApiGatewayConfig>('apiGateway');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.config.transformation.response.enabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = request['gatewayStartTime'] || Date.now();

    return next.handle().pipe(
      map(data => this.transformSuccessResponse(data, request, response, startTime)),
      catchError(error => {
        const transformedError = this.transformErrorResponse(error, request, response, startTime);
        throw transformedError;
      }),
    );
  }

  /**
   * Transform successful responses
   */
  private transformSuccessResponse(
    data: any,
    request: Request,
    response: Response,
    startTime: number,
  ): any {
    if (!this.config.transformation.response.wrapResponse) {
      return this.applyVersionTransformation(data, request);
    }

    const responseTime = Date.now() - startTime;
    const apiVersion = request['apiVersion'] || this.config.versioning.defaultVersion;
    
    // Build standard response structure
    const standardResponse: StandardApiResponse = {
      success: true,
      data: this.applyVersionTransformation(data, request),
      metadata: {
        version: apiVersion,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') as string,
        responseTime,
      },
    };

    // Add pagination metadata if present
    if (data && data.pagination) {
      standardResponse.metadata.pagination = data.pagination;
      // Remove pagination from data to avoid duplication
      if (standardResponse.data && standardResponse.data.pagination) {
        delete standardResponse.data.pagination;
      }
    }

    // Add custom metadata if configured
    if (this.config.transformation.response.includeMetadata) {
      standardResponse.metadata = {
        ...standardResponse.metadata,
        ...this.extractAdditionalMetadata(request, response),
      };
    }

    this.logger.debug(`Response transformed for ${request.path} (${responseTime}ms)`);
    return standardResponse;
  }

  /**
   * Transform error responses
   */
  private transformErrorResponse(
    error: any,
    request: Request,
    response: Response,
    startTime: number,
  ): any {
    if (!this.config.transformation.response.standardizeErrors) {
      return error;
    }

    const responseTime = Date.now() - startTime;
    const apiVersion = request['apiVersion'] || this.config.versioning.defaultVersion;

    // Determine error code and message
    const errorCode = this.getErrorCode(error);
    const errorMessage = this.getErrorMessage(error);
    const errorDetails = this.getErrorDetails(error);

    // Build standard error response
    const standardError: StandardApiResponse = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details: errorDetails,
      },
      metadata: {
        version: apiVersion,
        timestamp: new Date().toISOString(),
        requestId: response.getHeader('X-Request-ID') as string,
        responseTime,
      },
    };

    // Set appropriate HTTP status code
    const statusCode = this.getHttpStatusCode(error);
    response.status(statusCode);

    this.logger.error(`Error response for ${request.path}: ${errorMessage} (${responseTime}ms)`);
    return standardError;
  }

  /**
   * Apply version-specific transformations
   */
  private applyVersionTransformation(data: any, request: Request): any {
    const apiVersion = request['apiVersion'];
    if (!apiVersion || !data) {
      return data;
    }

    return this.versioningService.transformResponseForVersion(data, apiVersion);
  }

  /**
   * Extract additional metadata from request/response
   */
  private extractAdditionalMetadata(request: Request, response: Response): any {
    const metadata: any = {};

    // Add rate limit information if available
    const rateLimitHeaders = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'];
    rateLimitHeaders.forEach(header => {
      const value = response.getHeader(header);
      if (value) {
        const key = header.replace('X-RateLimit-', '').toLowerCase();
        metadata[`rateLimit${key.charAt(0).toUpperCase() + key.slice(1)}`] = value;
      }
    });

    // Add deprecation warnings if version is deprecated
    if (response.getHeader('X-API-Deprecated')) {
      metadata.deprecation = {
        deprecated: true,
        deprecationDate: response.getHeader('X-API-Deprecation-Date'),
        sunsetDate: response.getHeader('X-API-Sunset-Date'),
      };
    }

    // Add request method and path for reference
    metadata.request = {
      method: request.method,
      path: request.path,
      userAgent: request.headers['user-agent'],
    };

    return metadata;
  }

  /**
   * Get error code from error object
   */
  private getErrorCode(error: any): string {
    if (error.code) return error.code;
    if (error.name) return error.name;
    if (error.status) return `HTTP_${error.status}`;
    return 'INTERNAL_ERROR';
  }

  /**
   * Get error message from error object
   */
  private getErrorMessage(error: any): string {
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.response && error.response.message) return error.response.message;
    return 'An internal error occurred';
  }

  /**
   * Get error details from error object
   */
  private getErrorDetails(error: any): any {
    const details: any = {};

    if (error.response) {
      details.response = error.response;
    }

    if (error.stack && process.env.NODE_ENV !== 'production') {
      details.stack = error.stack;
    }

    if (error.validationErrors) {
      details.validation = error.validationErrors;
    }

    return Object.keys(details).length > 0 ? details : undefined;
  }

  /**
   * Get HTTP status code from error
   */
  private getHttpStatusCode(error: any): number {
    if (error.status) return error.status;
    if (error.statusCode) return error.statusCode;
    if (error.response && error.response.statusCode) return error.response.statusCode;
    
    // Default status codes based on error types
    if (error.name === 'ValidationError') return 400;
    if (error.name === 'UnauthorizedError') return 401;
    if (error.name === 'ForbiddenError') return 403;
    if (error.name === 'NotFoundError') return 404;
    if (error.name === 'ConflictError') return 409;
    if (error.name === 'TooManyRequestsError') return 429;
    
    return 500;
  }
}