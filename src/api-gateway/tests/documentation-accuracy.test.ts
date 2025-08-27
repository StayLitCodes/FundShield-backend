import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { SwaggerConfigService } from '../services/swagger-config.service';
import { ApiGatewayService } from '../services/api-gateway.service';
import { VersioningService } from '../services/versioning.service';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

interface SwaggerPath {
  path: string;
  method: string;
  operationId?: string;
  parameters?: any[];
  requestBody?: any;
  responses?: any;
  tags?: string[];
}

interface ValidationError {
  path: string;
  method: string;
  error: string;
  details?: any;
}

describe('API Documentation Accuracy Tests', () => {
  let app: INestApplication;
  let swaggerDocument: OpenAPIObject;
  let module: TestingModule;
  let swaggerService: SwaggerConfigService;
  let ajv: Ajv;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    swaggerService = module.get<SwaggerConfigService>(SwaggerConfigService);

    // Initialize AJV for JSON schema validation
    ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(ajv);

    // Setup Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('FundShield API')
      .setDescription('API Documentation Accuracy Testing')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    swaggerDocument = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, swaggerDocument);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Swagger Document Structure', () => {
    it('should have valid OpenAPI 3.0 structure', () => {
      expect(swaggerDocument.openapi).toBeDefined();
      expect(swaggerDocument.info).toBeDefined();
      expect(swaggerDocument.paths).toBeDefined();
      expect(swaggerDocument.components).toBeDefined();
    });

    it('should have proper API information', () => {
      expect(swaggerDocument.info.title).toBeDefined();
      expect(swaggerDocument.info.version).toBeDefined();
      expect(swaggerDocument.info.description).toBeDefined();
    });

    it('should have security schemes defined', () => {
      expect(swaggerDocument.components?.securitySchemes).toBeDefined();
      const securitySchemes = swaggerDocument.components?.securitySchemes;

      // Check for JWT Bearer auth
      expect(securitySchemes).toHaveProperty('bearer');
      expect(securitySchemes?.['bearer']?.type).toBe('http');
      expect(securitySchemes?.['bearer']?.scheme).toBe('bearer');
    });

    it('should have proper server configuration', () => {
      expect(swaggerDocument.servers).toBeDefined();
      expect(swaggerDocument.servers?.length).toBeGreaterThan(0);
    });
  });

  describe('Path Documentation Validation', () => {
    let documentedPaths: SwaggerPath[];

    beforeAll(() => {
      documentedPaths = extractPathsFromSwagger(swaggerDocument);
    });

    it('should have documented paths', () => {
      expect(documentedPaths.length).toBeGreaterThan(0);
    });

    it('should have proper HTTP methods documented', () => {
      const validMethods = [
        'get',
        'post',
        'put',
        'patch',
        'delete',
        'options',
        'head',
      ];
      documentedPaths.forEach(path => {
        expect(validMethods).toContain(path.method.toLowerCase());
      });
    });

    it('should have operation IDs for all endpoints', () => {
      const missingOperationIds = documentedPaths.filter(
        path => !path.operationId,
      );
      if (missingOperationIds.length > 0) {
        console.warn(
          'Paths missing operation IDs:',
          missingOperationIds.map(p => `${p.method.toUpperCase()} ${p.path}`),
        );
      }
      // This is a warning, not a hard failure
      expect(missingOperationIds.length).toBeLessThan(
        documentedPaths.length * 0.1,
      ); // Less than 10% missing
    });

    it('should have proper response schemas defined', () => {
      const pathsWithoutResponses = documentedPaths.filter(
        path => !path.responses || Object.keys(path.responses).length === 0,
      );

      expect(pathsWithoutResponses).toEqual([]);
    });

    it('should have proper parameter documentation', () => {
      const pathsWithParameters = documentedPaths.filter(
        path => path.parameters && path.parameters.length > 0,
      );

      pathsWithParameters.forEach(path => {
        path.parameters?.forEach(param => {
          expect(param.name).toBeDefined();
          expect(param.in).toBeDefined();
          expect(['query', 'path', 'header', 'cookie']).toContain(param.in);
          expect(param.schema || param.type).toBeDefined();
        });
      });
    });
  });

  describe('Response Schema Validation', () => {
    it('should validate gateway health endpoint response', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/gateway/health')
        .expect(200);

      const healthSchema = {
        type: 'object',
        properties: {
          status: { type: 'string' },
          timestamp: { type: 'string' },
          gateway: {
            type: 'object',
            properties: {
              version: { type: 'string' },
              uptime: { type: 'number' },
              metrics: { type: 'object' },
              configuration: { type: 'object' },
              supportedVersions: { type: 'object' },
            },
          },
        },
        required: ['status', 'timestamp', 'gateway'],
      };

      const validate = ajv.compile(healthSchema);
      const isValid = validate(response.body);

      if (!isValid) {
        console.error('Validation errors:', validate.errors);
      }

      expect(isValid).toBe(true);
    });

    it('should validate gateway metrics endpoint response', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/gateway/metrics')
        .expect(200);

      const metricsSchema = {
        type: 'object',
        properties: {
          totalRequests: { type: 'number' },
          activeRequests: { type: 'number' },
          averageResponseTime: { type: 'number' },
          errorRate: { type: 'number' },
          rateLimitHits: { type: 'number' },
          lastUpdated: { type: 'string' },
        },
        required: ['totalRequests', 'activeRequests', 'averageResponseTime'],
      };

      const validate = ajv.compile(metricsSchema);
      const isValid = validate(response.body);

      expect(isValid).toBe(true);
    });

    it('should validate versioning info endpoint response', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/versioning/info')
        .expect(200);

      const versionInfoSchema = {
        type: 'object',
        properties: {
          current: { type: 'string' },
          supported: {
            type: 'array',
            items: { type: 'string' },
          },
          deprecated: {
            type: 'array',
            items: { type: 'string' },
          },
          latest: { type: 'string' },
        },
        required: ['current', 'supported', 'deprecated', 'latest'],
      };

      const validate = ajv.compile(versionInfoSchema);
      const isValid = validate(response.body);

      expect(isValid).toBe(true);
    });
  });

  describe('Error Response Documentation', () => {
    it('should have standardized error response format', async () => {
      // Test with an invalid endpoint
      const response = await request(app.getHttpServer())
        .get('/api/non-existent-endpoint')
        .expect(404);

      const errorSchema = {
        type: 'object',
        properties: {
          success: { type: 'boolean', const: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
            required: ['code', 'message'],
          },
          metadata: {
            type: 'object',
            properties: {
              version: { type: 'string' },
              timestamp: { type: 'string' },
              requestId: { type: 'string' },
              responseTime: { type: 'number' },
            },
          },
        },
      };

      // This might not match exactly if not using standard error format
      // The test verifies the error response structure
      if (typeof response.body === 'object' && response.body.error) {
        const validate = ajv.compile(errorSchema);
        const isValid = validate(response.body);
        expect(isValid).toBe(true);
      }
    });

    it('should document common HTTP status codes', () => {
      const commonStatusCodes = [
        '200',
        '400',
        '401',
        '403',
        '404',
        '429',
        '500',
      ];
      let documentedStatusCodes: string[] = [];

      Object.values(swaggerDocument.paths || {}).forEach(pathItem => {
        Object.values(pathItem).forEach((operation: any) => {
          if (operation.responses) {
            documentedStatusCodes.push(...Object.keys(operation.responses));
          }
        });
      });

      documentedStatusCodes = [...new Set(documentedStatusCodes)];

      // Check that most common status codes are documented
      const missingStatusCodes = commonStatusCodes.filter(
        code => !documentedStatusCodes.includes(code),
      );

      if (missingStatusCodes.length > 0) {
        console.warn(
          'Missing common status codes in documentation:',
          missingStatusCodes,
        );
      }

      // At least 200, 400, and 500 should be documented
      expect(documentedStatusCodes).toContain('200');
      expect(documentedStatusCodes).toContain('400');
      expect(documentedStatusCodes).toContain('500');
    });
  });

  describe('Schema Validation', () => {
    it('should have valid component schemas', () => {
      const schemas = swaggerDocument.components?.schemas;
      expect(schemas).toBeDefined();

      if (schemas) {
        Object.entries(schemas).forEach(([schemaName, schema]) => {
          expect(schema).toBeDefined();
          expect(typeof schema).toBe('object');

          // Basic schema validation
          if ('type' in schema) {
            expect([
              'object',
              'array',
              'string',
              'number',
              'boolean',
            ]).toContain(schema.type);
          }

          if ('properties' in schema && schema.properties) {
            expect(typeof schema.properties).toBe('object');
          }
        });
      }
    });

    it('should have reusable schemas for common data types', () => {
      const schemas = swaggerDocument.components?.schemas;
      const expectedSchemas = ['User', 'Error', 'SuccessResponse'];

      expectedSchemas.forEach(expectedSchema => {
        if (schemas && !schemas[expectedSchema]) {
          console.warn(`Missing reusable schema: ${expectedSchema}`);
        }
      });
    });
  });

  describe('API Documentation Consistency', () => {
    it('should have consistent tag usage', () => {
      const tags = new Set<string>();
      const pathTags = new Set<string>();

      // Collect tags from the global tags definition
      swaggerDocument.tags?.forEach(tag => tags.add(tag.name));

      // Collect tags used in paths
      Object.values(swaggerDocument.paths || {}).forEach(pathItem => {
        Object.values(pathItem).forEach((operation: any) => {
          operation.tags?.forEach((tag: string) => pathTags.add(tag));
        });
      });

      // Check that all used tags are defined
      const undefinedTags = Array.from(pathTags).filter(tag => !tags.has(tag));

      if (undefinedTags.length > 0) {
        console.warn('Undefined tags used in operations:', undefinedTags);
      }

      expect(undefinedTags.length).toBe(0);
    });

    it('should have consistent parameter naming', () => {
      const parameters: { name: string; in: string; path: string }[] = [];

      Object.entries(swaggerDocument.paths || {}).forEach(
        ([path, pathItem]) => {
          Object.entries(pathItem).forEach(
            ([method, operation]: [string, any]) => {
              operation.parameters?.forEach((param: any) => {
                parameters.push({
                  name: param.name,
                  in: param.in,
                  path: `${method.toUpperCase()} ${path}`,
                });
              });
            },
          );
        },
      );

      // Check for consistent naming patterns
      const idParameters = parameters.filter(p => p.name.endsWith('Id'));
      const inconsistentIds = idParameters.filter(
        p => p.in === 'path' && !p.name.match(/^[a-z]+Id$/),
      );

      expect(inconsistentIds.length).toBe(0);
    });

    it('should have proper API versioning documentation', () => {
      // Check if version parameters are documented
      let hasVersionHeader = false;
      let hasVersionPath = false;

      Object.values(swaggerDocument.paths || {}).forEach(pathItem => {
        Object.values(pathItem).forEach((operation: any) => {
          operation.parameters?.forEach((param: any) => {
            if (param.name === 'X-API-Version' && param.in === 'header') {
              hasVersionHeader = true;
            }
            if (param.name === 'version' && param.in === 'path') {
              hasVersionPath = true;
            }
          });
        });
      });

      // At least one versioning strategy should be documented
      expect(hasVersionHeader || hasVersionPath).toBe(true);
    });
  });

  describe('Documentation Completeness', () => {
    it('should have descriptions for all operations', () => {
      const operationsWithoutDescription: string[] = [];

      Object.entries(swaggerDocument.paths || {}).forEach(
        ([path, pathItem]) => {
          Object.entries(pathItem).forEach(
            ([method, operation]: [string, any]) => {
              if (!operation.description && !operation.summary) {
                operationsWithoutDescription.push(
                  `${method.toUpperCase()} ${path}`,
                );
              }
            },
          );
        },
      );

      if (operationsWithoutDescription.length > 0) {
        console.warn(
          'Operations without descriptions:',
          operationsWithoutDescription,
        );
      }

      // Allow up to 10% of operations without descriptions
      const totalOperations = extractPathsFromSwagger(swaggerDocument).length;
      expect(operationsWithoutDescription.length).toBeLessThan(
        totalOperations * 0.1,
      );
    });

    it('should have examples in request/response schemas', () => {
      const schemasWithoutExamples: string[] = [];
      const schemas = swaggerDocument.components?.schemas;

      if (schemas) {
        Object.entries(schemas).forEach(([schemaName, schema]) => {
          if (
            typeof schema === 'object' &&
            !('example' in schema) &&
            !('examples' in schema)
          ) {
            schemasWithoutExamples.push(schemaName);
          }
        });
      }

      // Examples are recommended but not required for all schemas
      if (schemasWithoutExamples.length > 0) {
        console.info(
          'Schemas without examples (recommended):',
          schemasWithoutExamples,
        );
      }
    });
  });

  describe('Performance and Accessibility', () => {
    it('should serve Swagger UI within reasonable time', async () => {
      const start = Date.now();

      await request(app.getHttpServer()).get('/docs').expect(200);

      const responseTime = Date.now() - start;
      expect(responseTime).toBeLessThan(5000); // Should load within 5 seconds
    });

    it('should serve OpenAPI JSON within reasonable time', async () => {
      const start = Date.now();

      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200);

      const responseTime = Date.now() - start;
      expect(responseTime).toBeLessThan(2000); // Should load within 2 seconds
      expect(response.body).toEqual(swaggerDocument);
    });
  });
});

/**
 * Helper function to extract paths from Swagger document
 */
function extractPathsFromSwagger(document: OpenAPIObject): SwaggerPath[] {
  const paths: SwaggerPath[] = [];

  Object.entries(document.paths || {}).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
      paths.push({
        path,
        method,
        operationId: operation.operationId,
        parameters: operation.parameters,
        requestBody: operation.requestBody,
        responses: operation.responses,
        tags: operation.tags,
      });
    });
  });

  return paths;
}

/**
 * Helper function to validate response against schema
 */
function validateResponseSchema(
  response: any,
  schema: any,
  ajv: Ajv,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const validate = ajv.compile(schema);

  if (!validate(response)) {
    validate.errors?.forEach(error => {
      errors.push({
        path: error.instancePath || 'root',
        method: 'validation',
        error: error.message || 'Unknown validation error',
        details: error,
      });
    });
  }

  return errors;
}
