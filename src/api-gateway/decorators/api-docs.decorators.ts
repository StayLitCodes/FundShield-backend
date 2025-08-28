import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiProperty,
  ApiPropertyOptional,
  ApiExtraModels,
  getSchemaPath,
  ApiHeader,
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

/**
 * Enhanced API operation decorator with comprehensive documentation
 */
export function ApiOperationEnhanced(options: {
  summary: string;
  description: string;
  operationId?: string;
  tags?: string[];
  deprecated?: boolean;
  version?: string[];
  examples?: {
    request?: any;
    response?: any;
    error?: any;
  };
}) {
  const decorators = [
    ApiOperation({
      summary: options.summary,
      description: `
        ${options.description}
        
        ${options.version ? `**Supported Versions:** ${options.version.join(', ')}` : ''}
        ${options.deprecated ? '⚠️ **This endpoint is deprecated**' : ''}
        
        ---
        
        **Rate Limits:**
        - Standard: 100 requests per minute
        - Authenticated: 1000 requests per minute
        
        **Response Format:**
        All responses follow the standard API response format with success/error indicators and metadata.
      `,
      operationId: options.operationId,
      deprecated: options.deprecated,
    }),
  ];

  if (options.tags) {
    decorators.push(ApiTags(...options.tags));
  }

  return applyDecorators(...decorators);
}

/**
 * Comprehensive API response decorator with examples
 */
export function ApiResponseEnhanced(options: {
  status: number;
  description: string;
  type?: Type<unknown> | Function | [Function] | string;
  isArray?: boolean;
  examples?: Record<string, any>;
  headers?: Record<string, any>;
}) {
  const decorators = [
    ApiResponse({
      status: options.status,
      description: options.description,
      type: options.type,
      isArray: options.isArray,
      headers: options.headers,
    }),
  ];

  return applyDecorators(...decorators);
}

/**
 * Versioned API decorator for endpoints that support multiple versions
 */
export function ApiVersioned(versions: string[]) {
  return applyDecorators(
    ApiHeader({
      name: 'X-API-Version',
      description: `API version. Supported versions: ${versions.join(', ')}`,
      required: false,
      schema: {
        type: 'string',
        enum: versions,
        default: versions[0],
      },
    }),
  );
}

/**
 * Paginated response decorator
 */
export function ApiPaginatedResponse<TModel extends Type<any>>(model: TModel) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: 200,
      description: 'Paginated response',
      schema: {
        allOf: [
          {
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              metadata: {
                type: 'object',
                properties: {
                  version: { type: 'string', example: 'v1' },
                  timestamp: { type: 'string', format: 'date-time' },
                  requestId: { type: 'string' },
                  responseTime: { type: 'number' },
                  pagination: {
                    type: 'object',
                    properties: {
                      page: { type: 'number', example: 1 },
                      limit: { type: 'number', example: 20 },
                      total: { type: 'number', example: 100 },
                      totalPages: { type: 'number', example: 5 },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    }),
  );
}

/**
 * Standard error responses decorator
 */
export function ApiErrorResponses() {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description: 'Bad Request - Invalid input data',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Validation failed' },
              details: {
                type: 'object',
                properties: {
                  fields: { type: 'array', items: { type: 'string' } },
                  violations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        field: { type: 'string' },
                        message: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              version: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string' },
              responseTime: { type: 'number' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Authentication required',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'UNAUTHORIZED' },
              message: { type: 'string', example: 'Authentication required' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Insufficient permissions',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'FORBIDDEN' },
              message: { type: 'string', example: 'Insufficient permissions' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Not Found - Resource not found',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string', example: 'Resource not found' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 429,
      description: 'Too Many Requests - Rate limit exceeded',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'RATE_LIMIT_EXCEEDED' },
              message: { type: 'string', example: 'Rate limit exceeded' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal Server Error',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INTERNAL_ERROR' },
              message: { type: 'string', example: 'An internal error occurred' },
            },
          },
        },
      },
    }),
  );
}

/**
 * Authentication requirement decorator
 */
export function ApiAuthRequired(type: 'JWT' | 'ApiKey' | 'Both' = 'JWT') {
  const decorators = [];

  if (type === 'JWT' || type === 'Both') {
    decorators.push(ApiBearerAuth('JWT'));
  }

  if (type === 'ApiKey' || type === 'Both') {
    decorators.push(
      ApiHeader({
        name: 'X-API-Key',
        description: 'API key for authentication',
        required: true,
        schema: { type: 'string' },
      })
    );
  }

  return applyDecorators(...decorators);
}

/**
 * Query parameter decorator with comprehensive documentation
 */
export function ApiQueryEnhanced(options: {
  name: string;
  description: string;
  type?: any;
  required?: boolean;
  example?: any;
  enum?: any[];
  isArray?: boolean;
}) {
  return ApiQuery({
    name: options.name,
    description: options.description,
    required: options.required || false,
    type: options.type || String,
    example: options.example,
    enum: options.enum,
    isArray: options.isArray,
  });
}

/**
 * Path parameter decorator with validation
 */
export function ApiParamEnhanced(options: {
  name: string;
  description: string;
  type?: any;
  example?: any;
  enum?: any[];
}) {
  return ApiParam({
    name: options.name,
    description: options.description,
    type: options.type || String,
    example: options.example,
    enum: options.enum,
  });
}

/**
 * Request body decorator with examples
 */
export function ApiBodyEnhanced<TModel extends Type<any>>(
  model: TModel,
  options?: {
    description?: string;
    examples?: Record<string, any>;
    required?: boolean;
  }
) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiBody({
      type: model,
      description: options?.description,
      required: options?.required !== false,
    }),
  );
}

/**
 * Class decorator for API models with enhanced documentation
 */
export function ApiModelEnhanced(options: {
  description: string;
  example?: any;
  deprecated?: boolean;
}) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    // This would be applied to the class
    return constructor;
  };
}

/**
 * Property decorator with enhanced documentation
 */
export function ApiPropertyEnhanced(options: {
  description: string;
  example?: any;
  type?: any;
  format?: string;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  required?: boolean;
  nullable?: boolean;
  deprecated?: boolean;
}) {
  if (options.required !== false) {
    return ApiProperty({
      description: options.description,
      example: options.example,
      type: options.type,
      format: options.format,
      enum: options.enum,
      minimum: options.minimum,
      maximum: options.maximum,
      minLength: options.minLength,
      maxLength: options.maxLength,
      pattern: options.pattern,
      nullable: options.nullable,
      deprecated: options.deprecated,
    });
  } else {
    return ApiPropertyOptional({
      description: options.description,
      example: options.example,
      type: options.type,
      format: options.format,
      enum: options.enum,
      minimum: options.minimum,
      maximum: options.maximum,
      minLength: options.minLength,
      maxLength: options.maxLength,
      pattern: options.pattern,
      nullable: options.nullable,
      deprecated: options.deprecated,
    });
  }
}

/**
 * Complete endpoint documentation decorator
 */
export function ApiEndpoint(options: {
  operation: {
    summary: string;
    description: string;
    tags?: string[];
    deprecated?: boolean;
  };
  responses: {
    success: {
      status: number;
      description: string;
      type?: Type<unknown>;
      isArray?: boolean;
    };
    errors?: number[];
  };
  auth?: 'JWT' | 'ApiKey' | 'Both';
  versioning?: string[];
  rateLimit?: {
    limit: number;
    window: string;
  };
}) {
  const decorators = [
    ApiOperationEnhanced({
      summary: options.operation.summary,
      description: options.operation.description,
      tags: options.operation.tags,
      deprecated: options.operation.deprecated,
      version: options.versioning,
    }),
    ApiResponseEnhanced({
      status: options.responses.success.status,
      description: options.responses.success.description,
      type: options.responses.success.type,
      isArray: options.responses.success.isArray,
    }),
  ];

  if (options.responses.errors) {
    decorators.push(ApiErrorResponses());
  }

  if (options.auth) {
    decorators.push(ApiAuthRequired(options.auth));
  }

  if (options.versioning) {
    decorators.push(ApiVersioned(options.versioning));
  }

  return applyDecorators(...decorators);
}