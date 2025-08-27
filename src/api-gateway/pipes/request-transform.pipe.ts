import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiGatewayConfig } from '../config/api-gateway.config';

@Injectable()
export class RequestTransformPipe implements PipeTransform {
  private readonly config: ApiGatewayConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<ApiGatewayConfig>('apiGateway');
  }

  transform(value: any, metadata: ArgumentMetadata) {
    if (!this.config.transformation.enabled) {
      return value;
    }

    // Apply request transformations based on configuration
    if (metadata.type === 'body' && value) {
      return this.transformRequestBody(value, metadata);
    }

    if (metadata.type === 'query' && value) {
      return this.transformQueryParams(value, metadata);
    }

    return value;
  }

  private transformRequestBody(body: any, metadata: ArgumentMetadata): any {
    // Apply body transformations
    if (this.config.transformation.sanitizeInput) {
      body = this.sanitizeObject(body);
    }

    if (this.config.transformation.trimStrings) {
      body = this.trimStringFields(body);
    }

    return body;
  }

  private transformQueryParams(query: any, metadata: ArgumentMetadata): any {
    // Apply query parameter transformations
    if (this.config.transformation.trimStrings) {
      query = this.trimStringFields(query);
    }

    return query;
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        if (typeof value === 'string') {
          // Basic sanitization - remove potentially harmful characters
          sanitized[key] = value.replace(/[<>"'&]/g, '');
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  private trimStringFields(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return typeof obj === 'string' ? obj.trim() : obj;
    }

    const trimmed = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        if (typeof value === 'string') {
          trimmed[key] = value.trim();
        } else if (typeof value === 'object' && value !== null) {
          trimmed[key] = this.trimStringFields(value);
        } else {
          trimmed[key] = value;
        }
      }
    }

    return trimmed;
  }
}
import { ConfigService } from '@nestjs/config';
import { ApiGatewayConfig } from '../config/api-gateway.config';
import { VersioningService } from '../services/versioning.service';

@Injectable()
export class RequestTransformPipe implements PipeTransform {
  private readonly logger = new Logger(RequestTransformPipe.name);
  private readonly config: ApiGatewayConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly versioningService: VersioningService,
  ) {
    this.config = this.configService.get<ApiGatewayConfig>('apiGateway');
  }

  transform(value: any, metadata: ArgumentMetadata): any {
    if (!this.config.transformation.request.enabled) {
      return value;
    }

    // Only transform body and query parameters
    if (metadata.type !== 'body' && metadata.type !== 'query') {
      return value;
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    let transformed = { ...value };

    try {
      // Apply sanitization
      if (this.config.transformation.request.sanitize) {
        transformed = this.sanitizeObject(transformed);
      }

      // Remove sensitive fields
      transformed = this.removeSensitiveFields(transformed);

      // Apply version-specific transformations
      if (
        metadata.data &&
        (metadata.data as any).req &&
        (metadata.data as any).req.apiVersion
      ) {
        transformed = this.versioningService.transformRequestForVersion(
          { body: transformed } as any,
          (metadata.data as any).req.apiVersion,
        );
      }

      // Validate transformed object
      this.validateTransformedObject(transformed, metadata);

      this.logger.debug(`Request transformed for ${metadata.type}`);
      return transformed;
    } catch (error) {
      this.logger.error(`Request transformation failed: ${error.message}`);
      throw new BadRequestException({
        error: 'Request Transformation Failed',
        message: error.message,
        originalType: metadata.type,
      });
    }
  }

  /**
   * Sanitize object by removing potentially dangerous content
   */
  private sanitizeObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return this.sanitizeValue(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized = {};
    Object.keys(obj).forEach(key => {
      const sanitizedKey = this.sanitizeKey(key);
      if (sanitizedKey) {
        sanitized[sanitizedKey] = this.sanitizeObject(obj[key]);
      }
    });

    return sanitized;
  }

  /**
   * Sanitize individual values
   */
  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }
    return value;
  }

  /**
   * Sanitize string values
   */
  private sanitizeString(str: string): string {
    // Remove potential XSS attacks
    let sanitized = str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit length
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000);
    }

    return sanitized;
  }

  /**
   * Sanitize object keys
   */
  private sanitizeKey(key: string): string | null {
    // Reject keys with potentially dangerous patterns
    if (
      key.includes('__proto__') ||
      key.includes('constructor') ||
      key.includes('prototype') ||
      key.startsWith('$')
    ) {
      this.logger.warn(`Rejected dangerous key: ${key}`);
      return null;
    }

    return key;
  }

  /**
   * Remove sensitive fields from object
   */
  private removeSensitiveFields(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.removeSensitiveFields(item));
    }

    const cleaned = { ...obj };
    const sensitiveFields = this.config.transformation.request.removeFields;

    sensitiveFields.forEach(field => {
      if (field in cleaned) {
        delete cleaned[field];
        this.logger.debug(`Removed sensitive field: ${field}`);
      }
    });

    // Recursively clean nested objects
    Object.keys(cleaned).forEach(key => {
      if (cleaned[key] && typeof cleaned[key] === 'object') {
        cleaned[key] = this.removeSensitiveFields(cleaned[key]);
      }
    });

    return cleaned;
  }

  /**
   * Validate the transformed object
   */
  private validateTransformedObject(
    obj: any,
    metadata: ArgumentMetadata,
  ): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    // Check for maximum depth to prevent deep nesting attacks
    if (this.getObjectDepth(obj) > 10) {
      throw new Error('Object nesting too deep');
    }

    // Check for maximum number of properties
    if (this.getObjectPropertyCount(obj) > 1000) {
      throw new Error('Too many object properties');
    }

    // Check for circular references
    if (this.hasCircularReference(obj)) {
      throw new Error('Circular reference detected');
    }
  }

  /**
   * Calculate object depth
   */
  private getObjectDepth(obj: any, depth = 0): number {
    if (depth > 10) return depth; // Prevent infinite recursion

    if (!obj || typeof obj !== 'object') {
      return depth;
    }

    let maxDepth = depth;
    Object.values(obj).forEach(value => {
      if (value && typeof value === 'object') {
        const childDepth = this.getObjectDepth(value, depth + 1);
        maxDepth = Math.max(maxDepth, childDepth);
      }
    });

    return maxDepth;
  }

  /**
   * Count total object properties
   */
  private getObjectPropertyCount(obj: any): number {
    if (!obj || typeof obj !== 'object') {
      return 0;
    }

    let count = Object.keys(obj).length;
    Object.values(obj).forEach(value => {
      if (value && typeof value === 'object') {
        count += this.getObjectPropertyCount(value);
      }
    });

    return count;
  }

  /**
   * Check for circular references
   */
  private hasCircularReference(obj: any, seen = new WeakSet()): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    if (seen.has(obj)) {
      return true;
    }

    seen.add(obj);

    for (const value of Object.values(obj)) {
      if (this.hasCircularReference(value, seen)) {
        return true;
      }
    }

    seen.delete(obj);
    return false;
  }
}
