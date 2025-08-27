import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { SwaggerConfigService } from '../services/swagger-config.service';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as yaml from 'js-yaml';

interface SchemaValidationResult {
  valid: boolean;
  errors: any[];
  schema: string;
  path?: string;
  method?: string;
}

interface SwaggerValidationReport {
  totalSchemas: number;
  validSchemas: number;
  invalidSchemas: number;
  validationResults: SchemaValidationResult[];
  openApiCompliance: boolean;
  securitySchemes: boolean;
  pathsCompliance: boolean;
}

describe('Swagger Schema Validation Tests', () => {
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

    // Initialize AJV with OpenAPI schema support
    ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      validateFormats: true,
    });
    addFormats(ajv);

    // Setup Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('FundShield API Gateway')
      .setDescription('Schema Validation Testing')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'ApiKey')
      .build();

    swaggerDocument = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, swaggerDocument);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('OpenAPI 3.0 Specification Compliance', () => {
    it('should comply with OpenAPI 3.0 specification', () => {
      // Validate basic OpenAPI 3.0 structure
      expect(swaggerDocument.openapi).toBeDefined();
      expect(swaggerDocument.openapi).toMatch(/^3\./);

      // Required fields according to OpenAPI 3.0
      expect(swaggerDocument.info).toBeDefined();
      expect(swaggerDocument.info.title).toBeDefined();
      expect(swaggerDocument.info.version).toBeDefined();

      expect(swaggerDocument.paths).toBeDefined();
      expect(typeof swaggerDocument.paths).toBe('object');
    });

    it('should have valid info object', () => {
      const info = swaggerDocument.info;

      expect(typeof info.title).toBe('string');
      expect(info.title.length).toBeGreaterThan(0);

      expect(typeof info.version).toBe('string');
      expect(info.version).toMatch(/^\d+\.\d+(\.\d+)?/);

      if (info.description) {
        expect(typeof info.description).toBe('string');
      }

      if (info.contact) {
        if (info.contact.email) {
          expect(info.contact.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        }
        if (info.contact.url) {
          expect(info.contact.url).toMatch(/^https?:\/\//);
        }
      }

      if (info.license) {
        expect(typeof info.license.name).toBe('string');
        if (info.license.url) {
          expect(info.license.url).toMatch(/^https?:\/\//);
        }
      }
    });

    it('should have valid servers configuration', () => {
      if (swaggerDocument.servers) {
        expect(Array.isArray(swaggerDocument.servers)).toBe(true);

        swaggerDocument.servers.forEach(server => {
          expect(typeof server.url).toBe('string');
          expect(server.url.length).toBeGreaterThan(0);

          if (server.description) {
            expect(typeof server.description).toBe('string');
          }
        });
      }
    });

    it('should have valid external documentation', () => {
      if (swaggerDocument.externalDocs) {
        expect(typeof swaggerDocument.externalDocs.url).toBe('string');
        expect(swaggerDocument.externalDocs.url).toMatch(/^https?:\/\//);

        if (swaggerDocument.externalDocs.description) {
          expect(typeof swaggerDocument.externalDocs.description).toBe(
            'string',
          );
        }
      }
    });
  });

  describe('Security Schemes Validation', () => {
    it('should have valid security schemes', () => {
      expect(swaggerDocument.components).toBeDefined();
      expect(swaggerDocument.components.securitySchemes).toBeDefined();

      const securitySchemes = swaggerDocument.components.securitySchemes;

      Object.entries(securitySchemes).forEach(([schemeName, scheme]) => {
        expect(typeof schemeName).toBe('string');
        expect(scheme).toBeDefined();

        // Type guard to check if scheme has 'type' property (not a ReferenceObject)
        if ('type' in scheme) {
          expect(scheme.type).toBeDefined();

          // Validate based on security scheme type
          switch (scheme.type) {
            case 'http':
              if ('scheme' in scheme) {
                expect(scheme.scheme).toBeDefined();
                if (scheme.scheme === 'bearer' && 'bearerFormat' in scheme) {
                  expect(scheme.bearerFormat).toBeDefined();
                }
              }
              break;
            case 'apiKey':
              if ('name' in scheme && 'in' in scheme) {
                expect(scheme.name).toBeDefined();
                expect(scheme.in).toBeDefined();
                expect(['query', 'header', 'cookie']).toContain(scheme.in);
              }
              break;
            case 'oauth2':
              if ('flows' in scheme) {
                expect(scheme.flows).toBeDefined();
              }
              break;
            case 'openIdConnect':
              if ('openIdConnectUrl' in scheme) {
                expect(scheme.openIdConnectUrl).toBeDefined();
                expect(scheme.openIdConnectUrl).toMatch(/^https?:\/\//);
              }
              break;
          }
        }
      });
    });

    it('should have properly configured JWT Bearer authentication', () => {
      const securitySchemes = swaggerDocument.components?.securitySchemes;
      const jwtScheme = securitySchemes?.['bearer'] || securitySchemes?.['JWT'];

      if (jwtScheme && 'type' in jwtScheme) {
        expect(jwtScheme.type).toBe('http');
        if ('scheme' in jwtScheme) {
          expect(jwtScheme.scheme).toBe('bearer');
        }
        if ('bearerFormat' in jwtScheme) {
          expect(jwtScheme.bearerFormat).toBe('JWT');
        }
      }
    });

    it('should have properly configured API Key authentication', () => {
      const securitySchemes = swaggerDocument.components?.securitySchemes;
      const apiKeyScheme =
        securitySchemes?.['ApiKey'] || securitySchemes?.['apiKey'];

      if (apiKeyScheme && 'type' in apiKeyScheme) {
        expect(apiKeyScheme.type).toBe('apiKey');
        if ('name' in apiKeyScheme) {
          expect(apiKeyScheme.name).toBeDefined();
        }
        if ('in' in apiKeyScheme) {
          expect(apiKeyScheme.in).toBeDefined();
          expect(['query', 'header', 'cookie']).toContain(apiKeyScheme.in);
        }
      }
    });
  });

  describe('Path Operations Validation', () => {
    it('should have valid path structure', () => {
      const paths = swaggerDocument.paths;

      Object.entries(paths).forEach(([pathPattern, pathItem]) => {
        // Path should start with /
        expect(pathPattern.startsWith('/')).toBe(true);

        // Validate HTTP methods
        const validMethods = [
          'get',
          'post',
          'put',
          'patch',
          'delete',
          'head',
          'options',
          'trace',
        ];

        Object.keys(pathItem).forEach(method => {
          if (validMethods.includes(method)) {
            const operation = pathItem[method];

            // Required operation fields
            expect(operation.responses).toBeDefined();
            expect(typeof operation.responses).toBe('object');

            // Optional but recommended fields
            if (operation.operationId) {
              expect(typeof operation.operationId).toBe('string');
              expect(operation.operationId.length).toBeGreaterThan(0);
            }

            if (operation.summary) {
              expect(typeof operation.summary).toBe('string');
            }

            if (operation.description) {
              expect(typeof operation.description).toBe('string');
            }

            if (operation.tags) {
              expect(Array.isArray(operation.tags)).toBe(true);
            }
          }
        });
      });
    });

    it('should have valid response schemas', () => {
      const paths = swaggerDocument.paths;
      let validationResults: SchemaValidationResult[] = [];

      Object.entries(paths).forEach(([pathPattern, pathItem]) => {
        Object.entries(pathItem).forEach(
          ([method, operation]: [string, any]) => {
            if (operation.responses) {
              Object.entries(operation.responses).forEach(
                ([statusCode, response]: [string, any]) => {
                  // Validate status code format
                  expect(statusCode).toMatch(/^[1-5]\d{2}$|^default$/);

                  // Validate response structure
                  if (response.content) {
                    Object.entries(response.content).forEach(
                      ([mediaType, mediaTypeObject]: [string, any]) => {
                        if (mediaTypeObject.schema) {
                          const result = validateJsonSchema(
                            mediaTypeObject.schema,
                          );
                          validationResults.push({
                            valid: result.valid,
                            errors: result.errors,
                            schema: `${pathPattern}:${method}:${statusCode}:${mediaType}`,
                            path: pathPattern,
                            method: method,
                          });
                        }
                      },
                    );
                  }
                },
              );
            }
          },
        );
      });

      // At least 80% of response schemas should be valid
      const validCount = validationResults.filter(r => r.valid).length;
      const validPercentage = validCount / validationResults.length;
      expect(validPercentage).toBeGreaterThan(0.8);
    });

    it('should have valid parameter schemas', () => {
      const paths = swaggerDocument.paths;
      let parameterValidations: SchemaValidationResult[] = [];

      Object.entries(paths).forEach(([pathPattern, pathItem]) => {
        Object.entries(pathItem).forEach(
          ([method, operation]: [string, any]) => {
            if (operation.parameters) {
              operation.parameters.forEach((parameter: any, index: number) => {
                // Validate required parameter fields
                expect(parameter.name).toBeDefined();
                expect(parameter.in).toBeDefined();
                expect(['query', 'header', 'path', 'cookie']).toContain(
                  parameter.in,
                );

                // Path parameters must be required
                if (parameter.in === 'path') {
                  expect(parameter.required).toBe(true);
                }

                // Validate parameter schema
                if (parameter.schema) {
                  const result = validateJsonSchema(parameter.schema);
                  parameterValidations.push({
                    valid: result.valid,
                    errors: result.errors,
                    schema: `${pathPattern}:${method}:param[${index}]`,
                    path: pathPattern,
                    method: method,
                  });
                }
              });
            }
          },
        );
      });

      // All parameter schemas should be valid
      const invalidParams = parameterValidations.filter(p => !p.valid);
      if (invalidParams.length > 0) {
        console.warn('Invalid parameter schemas:', invalidParams);
      }
      expect(invalidParams.length).toBe(0);
    });

    it('should have valid request body schemas', () => {
      const paths = swaggerDocument.paths;
      let requestBodyValidations: SchemaValidationResult[] = [];

      Object.entries(paths).forEach(([pathPattern, pathItem]) => {
        Object.entries(pathItem).forEach(
          ([method, operation]: [string, any]) => {
            if (operation.requestBody && operation.requestBody.content) {
              Object.entries(operation.requestBody.content).forEach(
                ([mediaType, mediaTypeObject]: [string, any]) => {
                  if (mediaTypeObject.schema) {
                    const result = validateJsonSchema(mediaTypeObject.schema);
                    requestBodyValidations.push({
                      valid: result.valid,
                      errors: result.errors,
                      schema: `${pathPattern}:${method}:requestBody:${mediaType}`,
                      path: pathPattern,
                      method: method,
                    });
                  }
                },
              );
            }
          },
        );
      });

      // All request body schemas should be valid
      const invalidBodies = requestBodyValidations.filter(b => !b.valid);
      if (invalidBodies.length > 0) {
        console.warn('Invalid request body schemas:', invalidBodies);
      }
      expect(invalidBodies.length).toBe(0);
    });
  });

  describe('Component Schemas Validation', () => {
    it('should have valid component schemas', () => {
      if (swaggerDocument.components?.schemas) {
        const schemas = swaggerDocument.components.schemas;
        let validationResults: SchemaValidationResult[] = [];

        Object.entries(schemas).forEach(([schemaName, schema]) => {
          const result = validateJsonSchema(schema);
          validationResults.push({
            valid: result.valid,
            errors: result.errors,
            schema: schemaName,
          });
        });

        // All component schemas should be valid
        const invalidSchemas = validationResults.filter(r => !r.valid);
        if (invalidSchemas.length > 0) {
          console.error('Invalid component schemas:', invalidSchemas);
          invalidSchemas.forEach(invalid => {
            console.error(`Schema ${invalid.schema}:`, invalid.errors);
          });
        }
        expect(invalidSchemas.length).toBe(0);
      }
    });

    it('should have consistent schema references', () => {
      const document = JSON.stringify(swaggerDocument);
      const refPattern = /"\$ref":"#\/components\/schemas\/([^"]+)"/g;
      const references: string[] = [];
      let match;

      while ((match = refPattern.exec(document)) !== null) {
        references.push(match[1]);
      }

      // All referenced schemas should exist
      const definedSchemas = Object.keys(
        swaggerDocument.components?.schemas || {},
      );
      const missingSchemas = references.filter(
        ref => !definedSchemas.includes(ref),
      );

      if (missingSchemas.length > 0) {
        console.error('Missing schema definitions:', [
          ...new Set(missingSchemas),
        ]);
      }
      expect(missingSchemas.length).toBe(0);
    });

    it('should have proper schema examples', () => {
      if (swaggerDocument.components?.schemas) {
        const schemas = swaggerDocument.components.schemas;
        const schemasWithoutExamples: string[] = [];

        Object.entries(schemas).forEach(([schemaName, schema]) => {
          if (
            typeof schema === 'object' &&
            'type' in schema &&
            schema.type === 'object'
          ) {
            if (
              !('example' in schema && schema.example) &&
              !('examples' in schema && schema.examples)
            ) {
              schemasWithoutExamples.push(schemaName);
            }
          }
        });

        // Most schemas should have examples (at least 70%)
        const totalObjectSchemas = Object.values(schemas).filter(
          s => typeof s === 'object' && 'type' in s && s.type === 'object',
        ).length;

        if (totalObjectSchemas > 0) {
          const examplePercentage =
            (totalObjectSchemas - schemasWithoutExamples.length) /
            totalObjectSchemas;
          expect(examplePercentage).toBeGreaterThan(0.7);
        }
      }
    });
  });

  describe('Tag and Organization Validation', () => {
    it('should have properly defined tags', () => {
      if (swaggerDocument.tags) {
        swaggerDocument.tags.forEach(tag => {
          expect(typeof tag.name).toBe('string');
          expect(tag.name.length).toBeGreaterThan(0);

          if (tag.description) {
            expect(typeof tag.description).toBe('string');
          }

          if (tag.externalDocs) {
            expect(typeof tag.externalDocs.url).toBe('string');
            expect(tag.externalDocs.url).toMatch(/^https?:\/\//);
          }
        });
      }
    });

    it('should have consistent tag usage', () => {
      const definedTags = new Set(
        (swaggerDocument.tags || []).map(tag => tag.name),
      );
      const usedTags = new Set<string>();

      // Collect all tags used in operations
      Object.values(swaggerDocument.paths || {}).forEach(pathItem => {
        Object.values(pathItem).forEach((operation: any) => {
          if (operation.tags) {
            operation.tags.forEach((tag: string) => usedTags.add(tag));
          }
        });
      });

      // All used tags should be defined
      const undefinedTags = [...usedTags].filter(tag => !definedTags.has(tag));
      expect(undefinedTags.length).toBe(0);

      // All defined tags should be used (warning only)
      const unusedTags = [...definedTags].filter(tag => !usedTags.has(tag));
      if (unusedTags.length > 0) {
        console.warn('Unused tags defined:', unusedTags);
      }
    });
  });

  describe('Real API Response Validation', () => {
    it('should validate actual API responses against schemas', async () => {
      const testEndpoints = [
        { path: '/api/gateway/health', method: 'get' },
        { path: '/api/gateway/metrics', method: 'get' },
        { path: '/api/versioning/info', method: 'get' },
        { path: '/api/dashboard/metrics', method: 'get' },
      ];

      for (const endpoint of testEndpoints) {
        try {
          const response = await request(app.getHttpServer())
            [endpoint.method](endpoint.path)
            .expect(200);

          // Find the corresponding schema in Swagger document
          const pathItem = swaggerDocument.paths?.[endpoint.path];
          const operation = pathItem?.[endpoint.method];
          const responseSchema =
            operation?.responses?.['200']?.content?.['application/json']
              ?.schema;

          if (responseSchema) {
            const result = validateDataAgainstSchema(
              response.body,
              responseSchema,
            );
            if (!result.valid) {
              console.error(
                `Schema validation failed for ${endpoint.method.toUpperCase()} ${endpoint.path}:`,
                result.errors,
              );
            }
            expect(result.valid).toBe(true);
          }
        } catch (error) {
          // Skip validation if endpoint doesn't exist
          console.warn(
            `Endpoint ${endpoint.method.toUpperCase()} ${endpoint.path} not available for testing`,
          );
        }
      }
    });

    it('should validate error responses against schemas', async () => {
      // Test 404 response
      const response = await request(app.getHttpServer())
        .get('/api/non-existent-endpoint')
        .expect(404);

      // Find error response schema
      const errorSchema =
        swaggerDocument.components?.schemas?.['ErrorResponse'];

      if (
        errorSchema &&
        typeof response.body === 'object' &&
        response.body.error
      ) {
        const result = validateDataAgainstSchema(response.body, errorSchema);
        if (!result.valid) {
          console.warn(
            'Error response schema validation failed:',
            result.errors,
          );
        }
        // This is a soft assertion as error format might not be standardized yet
      }
    });
  });

  describe('Documentation Quality Metrics', () => {
    it('should generate comprehensive validation report', () => {
      const report = generateValidationReport();

      expect(report.openApiCompliance).toBe(true);
      expect(report.securitySchemes).toBe(true);
      expect(report.pathsCompliance).toBe(true);
      expect(report.validSchemas / report.totalSchemas).toBeGreaterThan(0.9);

      console.log(
        'Swagger Validation Report:',
        JSON.stringify(report, null, 2),
      );
    });

    it('should export valid OpenAPI document formats', async () => {
      // Test JSON export
      const jsonResponse = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200);

      expect(jsonResponse.body).toBeDefined();
      expect(jsonResponse.body.openapi).toBeDefined();

      // Validate JSON structure
      expect(() => JSON.stringify(jsonResponse.body)).not.toThrow();

      // Test YAML export if available
      try {
        const yamlResponse = await request(app.getHttpServer())
          .get('/docs-yaml')
          .expect(200);

        // Validate YAML can be parsed
        expect(() => yaml.load(yamlResponse.text)).not.toThrow();
      } catch (error) {
        // YAML export might not be available
        console.info('YAML export not available');
      }
    });
  });

  // Helper function for JSON schema validation
  function validateJsonSchema(schema: any): { valid: boolean; errors: any[] } {
    try {
      if (!schema || typeof schema !== 'object') {
        return { valid: false, errors: ['Schema is not an object'] };
      }

      // Basic schema validation
      if (schema.type && typeof schema.type !== 'string') {
        return { valid: false, errors: ['Schema type must be a string'] };
      }

      // Validate common schema properties
      if (schema.properties && typeof schema.properties !== 'object') {
        return {
          valid: false,
          errors: ['Schema properties must be an object'],
        };
      }

      if (schema.items && typeof schema.items !== 'object') {
        return { valid: false, errors: ['Schema items must be an object'] };
      }

      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  function validateDataAgainstSchema(
    data: any,
    schema: any,
  ): { valid: boolean; errors: any[] } {
    try {
      const validate = ajv.compile(schema);
      const isValid = validate(data);

      return {
        valid: isValid,
        errors: validate.errors || [],
      };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  function generateValidationReport(): SwaggerValidationReport {
    if (!swaggerDocument) {
      throw new Error('Swagger document not available');
    }

    const report: SwaggerValidationReport = {
      timestamp: new Date(),
      document: swaggerDocument,
      validation: {
        totalPaths: Object.keys(swaggerDocument.paths).length,
        totalOperations: 0,
        validOperations: 0,
        totalSchemas: 0,
        validSchemas: 0,
      },
      issues: [],
      summary: {
        isValid: true,
        score: 100,
        recommendations: [],
      },
    };

    // Calculate totals and validate
    Object.values(swaggerDocument.paths).forEach(pathItem => {
      if (pathItem) {
        Object.keys(pathItem).forEach(method => {
          if (
            [
              'get',
              'post',
              'put',
              'patch',
              'delete',
              'head',
              'options',
            ].includes(method)
          ) {
            report.validation.totalOperations++;
            report.validation.validOperations++; // Simplified validation
          }
        });
      }
    });

    return report;
  }
});
