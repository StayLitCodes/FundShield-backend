import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiGatewayConfig } from '../config/api-gateway.config';

export interface TransformationRule {
  field: string;
  sourceVersion: string;
  targetVersion: string;
  transformation: 'rename' | 'remove' | 'convert' | 'default' | 'custom';
  from?: string;
  to?: string;
  defaultValue?: any;
  converter?: (value: any) => any;
}

export interface TransformationSchema {
  version: string;
  rules: TransformationRule[];
}

@Injectable()
export class TransformationService {
  private readonly logger = new Logger(TransformationService.name);
  private readonly config: ApiGatewayConfig;
  private readonly transformationSchemas = new Map<string, TransformationSchema>();

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<ApiGatewayConfig>('apiGateway');
    this.initializeTransformationSchemas();
  }

  /**
   * Initialize predefined transformation schemas
   */
  private initializeTransformationSchemas(): void {
    // V1 to V2 transformation schema
    const v1ToV2Schema: TransformationSchema = {
      version: 'v1_to_v2',
      rules: [
        {
          field: 'user_id',
          sourceVersion: 'v1',
          targetVersion: 'v2',
          transformation: 'rename',
          from: 'user_id',
          to: 'userId',
        },
        {
          field: 'created_at',
          sourceVersion: 'v1',
          targetVersion: 'v2',
          transformation: 'rename',
          from: 'created_at',
          to: 'createdAt',
        },
        {
          field: 'updated_at',
          sourceVersion: 'v1',
          targetVersion: 'v2',
          transformation: 'rename',
          from: 'updated_at',
          to: 'updatedAt',
        },
        {
          field: 'metadata',
          sourceVersion: 'v1',
          targetVersion: 'v2',
          transformation: 'default',
          defaultValue: {},
        },
      ],
    };

    // V2 to V1 transformation schema (reverse)
    const v2ToV1Schema: TransformationSchema = {
      version: 'v2_to_v1',
      rules: [
        {
          field: 'userId',
          sourceVersion: 'v2',
          targetVersion: 'v1',
          transformation: 'rename',
          from: 'userId',
          to: 'user_id',
        },
        {
          field: 'createdAt',
          sourceVersion: 'v2',
          targetVersion: 'v1',
          transformation: 'rename',
          from: 'createdAt',
          to: 'created_at',
        },
        {
          field: 'updatedAt',
          sourceVersion: 'v2',
          targetVersion: 'v1',
          transformation: 'rename',
          from: 'updatedAt',
          to: 'updated_at',
        },
        {
          field: 'metadata',
          sourceVersion: 'v2',
          targetVersion: 'v1',
          transformation: 'remove',
        },
      ],
    };

    this.transformationSchemas.set('v1_to_v2', v1ToV2Schema);
    this.transformationSchemas.set('v2_to_v1', v2ToV1Schema);

    this.logger.log(`Initialized ${this.transformationSchemas.size} transformation schemas`);
  }

  /**
   * Transform data from one version to another
   */
  transformData(
    data: any,
    sourceVersion: string,
    targetVersion: string,
  ): any {
    if (!data || sourceVersion === targetVersion) {
      return data;
    }

    const schemaKey = `${sourceVersion}_to_${targetVersion}`;
    const schema = this.transformationSchemas.get(schemaKey);

    if (!schema) {
      this.logger.warn(`No transformation schema found for ${schemaKey}`);
      return data;
    }

    return this.applyTransformationSchema(data, schema);
  }

  /**
   * Apply transformation schema to data
   */
  private applyTransformationSchema(data: any, schema: TransformationSchema): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.applyTransformationSchema(item, schema));
    }

    let transformed = { ...data };

    schema.rules.forEach(rule => {
      transformed = this.applyTransformationRule(transformed, rule);
    });

    this.logger.debug(`Applied ${schema.rules.length} transformation rules for ${schema.version}`);
    return transformed;
  }

  /**
   * Apply individual transformation rule
   */
  private applyTransformationRule(data: any, rule: TransformationRule): any {
    switch (rule.transformation) {
      case 'rename':
        return this.applyRenameRule(data, rule);
      case 'remove':
        return this.applyRemoveRule(data, rule);
      case 'convert':
        return this.applyConvertRule(data, rule);
      case 'default':
        return this.applyDefaultRule(data, rule);
      case 'custom':
        return this.applyCustomRule(data, rule);
      default:
        this.logger.warn(`Unknown transformation type: ${rule.transformation}`);
        return data;
    }
  }

  /**
   * Apply rename transformation rule
   */
  private applyRenameRule(data: any, rule: TransformationRule): any {
    if (!rule.from || !rule.to || !(rule.from in data)) {
      return data;
    }

    const transformed = { ...data };
    transformed[rule.to] = transformed[rule.from];
    delete transformed[rule.from];

    return transformed;
  }

  /**
   * Apply remove transformation rule
   */
  private applyRemoveRule(data: any, rule: TransformationRule): any {
    if (!(rule.field in data)) {
      return data;
    }

    const transformed = { ...data };
    delete transformed[rule.field];

    return transformed;
  }

  /**
   * Apply convert transformation rule
   */
  private applyConvertRule(data: any, rule: TransformationRule): any {
    if (!(rule.field in data) || !rule.converter) {
      return data;
    }

    const transformed = { ...data };
    try {
      transformed[rule.field] = rule.converter(transformed[rule.field]);
    } catch (error) {
      this.logger.error(`Conversion failed for field ${rule.field}: ${error.message}`);
    }

    return transformed;
  }

  /**
   * Apply default value transformation rule
   */
  private applyDefaultRule(data: any, rule: TransformationRule): any {
    if (rule.field in data) {
      return data; // Field already exists
    }

    const transformed = { ...data };
    transformed[rule.field] = rule.defaultValue;

    return transformed;
  }

  /**
   * Apply custom transformation rule
   */
  private applyCustomRule(data: any, rule: TransformationRule): any {
    if (!rule.converter) {
      this.logger.warn(`Custom rule for ${rule.field} missing converter function`);
      return data;
    }

    try {
      return rule.converter(data);
    } catch (error) {
      this.logger.error(`Custom transformation failed for ${rule.field}: ${error.message}`);
      return data;
    }
  }

  /**
   * Register new transformation schema
   */
  registerTransformationSchema(schema: TransformationSchema): void {
    this.transformationSchemas.set(schema.version, schema);
    this.logger.log(`Registered transformation schema: ${schema.version}`);
  }

  /**
   * Get available transformation schemas
   */
  getTransformationSchemas(): string[] {
    return Array.from(this.transformationSchemas.keys());
  }

  /**
   * Transform request data based on version
   */
  transformRequestData(data: any, version: string): any {
    // Apply common request transformations
    let transformed = this.applyRequestSanitization(data);

    // Apply version-specific transformations
    if (version === 'v1') {
      transformed = this.transformToV1Request(transformed);
    } else if (version === 'v2') {
      transformed = this.transformToV2Request(transformed);
    }

    return transformed;
  }

  /**
   * Transform response data based on version
   */
  transformResponseData(data: any, version: string): any {
    // Apply version-specific transformations
    if (version === 'v1') {
      return this.transformToV1Response(data);
    } else if (version === 'v2') {
      return this.transformToV2Response(data);
    }

    return data;
  }

  /**
   * Apply request sanitization
   */
  private applyRequestSanitization(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = this.config.transformation.request.removeFields;
    let sanitized = { ...data };

    // Remove sensitive fields
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        delete sanitized[field];
      }
    });

    // Recursively sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] && typeof sanitized[key] === 'object') {
        sanitized[key] = this.applyRequestSanitization(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Transform to V1 request format
   */
  private transformToV1Request(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Convert camelCase to snake_case for V1
    return this.convertKeysToSnakeCase(data);
  }

  /**
   * Transform to V2 request format
   */
  private transformToV2Request(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // V2 uses camelCase, convert from snake_case if needed
    return this.convertKeysToCamelCase(data);
  }

  /**
   * Transform to V1 response format
   */
  private transformToV1Response(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Convert to snake_case and remove metadata for V1 compatibility
    let transformed = this.convertKeysToSnakeCase(data);
    
    // Remove V2-specific fields
    if (transformed.metadata) {
      delete transformed.metadata;
    }

    return transformed;
  }

  /**
   * Transform to V2 response format
   */
  private transformToV2Response(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Ensure camelCase format and add metadata
    let transformed = this.convertKeysToCamelCase(data);

    // Add metadata if not present
    if (!transformed.metadata) {
      transformed.metadata = {
        version: 'v2',
        timestamp: new Date().toISOString(),
      };
    }

    return transformed;
  }

  /**
   * Convert object keys to snake_case
   */
  private convertKeysToSnakeCase(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.convertKeysToSnakeCase(item));
    }

    const result = {};
    Object.keys(obj).forEach(key => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      result[snakeKey] = this.convertKeysToSnakeCase(obj[key]);
    });

    return result;
  }

  /**
   * Convert object keys to camelCase
   */
  private convertKeysToCamelCase(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.convertKeysToCamelCase(item));
    }

    const result = {};
    Object.keys(obj).forEach(key => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = this.convertKeysToCamelCase(obj[key]);
    });

    return result;
  }

  /**
   * Create transformation rule
   */
  createTransformationRule(
    field: string,
    sourceVersion: string,
    targetVersion: string,
    transformation: TransformationRule['transformation'],
    options?: Partial<TransformationRule>,
  ): TransformationRule {
    return {
      field,
      sourceVersion,
      targetVersion,
      transformation,
      ...options,
    };
  }

  /**
   * Validate transformation schema
   */
  validateTransformationSchema(schema: TransformationSchema): boolean {
    if (!schema.version || !schema.rules || !Array.isArray(schema.rules)) {
      return false;
    }

    return schema.rules.every(rule => {
      return (
        rule.field &&
        rule.sourceVersion &&
        rule.targetVersion &&
        rule.transformation &&
        ['rename', 'remove', 'convert', 'default', 'custom'].includes(rule.transformation)
      );
    });
  }
}