import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { ApiGatewayConfig } from '../config/api-gateway.config';

export interface SwaggerOptions {
  title: string;
  description: string;
  version: string;
  path: string;
  enableVersioning: boolean;
  enableExamples: boolean;
  enableSchemas: boolean;
  enableSecurity: boolean;
}

export interface ApiExample {
  summary: string;
  description: string;
  value: any;
}

export interface ApiSchema {
  name: string;
  schema: any;
  examples?: ApiExample[];
}

@Injectable()
export class SwaggerConfigService {
  private readonly logger = new Logger(SwaggerConfigService.name);
  private readonly config: ApiGatewayConfig;
  private readonly customSchemas = new Map<string, ApiSchema>();
  private readonly customExamples = new Map<string, ApiExample[]>();

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<ApiGatewayConfig>('apiGateway');
    this.initializeCustomSchemas();
    this.initializeCustomExamples();
  }

  /**
   * Initialize custom schemas for documentation
   */
  private initializeCustomSchemas(): void {
    // User schema
    this.customSchemas.set('User', {
      name: 'User',
      schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'user@fundshield.com',
          },
          firstName: { type: 'string', example: 'John' },
          lastName: { type: 'string', example: 'Doe' },
          role: {
            type: 'string',
            enum: ['user', 'admin', 'moderator'],
            example: 'user',
          },
          isActive: { type: 'boolean', example: true },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00Z',
          },
        },
        required: ['id', 'email', 'firstName', 'lastName', 'role'],
      },
    });

    // Fund schema
    this.customSchemas.set('Fund', {
      name: 'Fund',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Investment Fund Alpha' },
          description: {
            type: 'string',
            example:
              'A diversified investment fund focused on technology stocks',
          },
          totalValue: { type: 'number', format: 'decimal', example: 1000000.5 },
          currency: { type: 'string', example: 'USD' },
          managerId: { type: 'string', format: 'uuid' },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending'],
            example: 'active',
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    });

    // Transaction schema
    this.customSchemas.set('Transaction', {
      name: 'Transaction',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          fromUserId: { type: 'string', format: 'uuid' },
          toUserId: { type: 'string', format: 'uuid' },
          amount: { type: 'number', format: 'decimal', example: 500.0 },
          currency: { type: 'string', example: 'USD' },
          type: {
            type: 'string',
            enum: ['deposit', 'withdrawal', 'transfer', 'payment'],
          },
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'failed', 'cancelled'],
          },
          description: { type: 'string', example: 'Payment for services' },
          metadata: { type: 'object', additionalProperties: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    });

    // Error Response schema
    this.customSchemas.set('ErrorResponse', {
      name: 'ErrorResponse',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: {
                type: 'string',
                example: 'Validation failed for the provided data',
              },
              details: { type: 'object', additionalProperties: true },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              version: { type: 'string', example: 'v1' },
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string', example: 'req_1234567890_abcdef' },
              responseTime: { type: 'number', example: 123 },
            },
          },
        },
      },
    });

    // Standard API Response schema
    this.customSchemas.set('StandardResponse', {
      name: 'StandardResponse',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object', description: 'Response data' },
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
    });

    this.logger.log(`Initialized ${this.customSchemas.size} custom schemas`);
  }

  /**
   * Initialize custom examples for documentation
   */
  private initializeCustomExamples(): void {
    // User examples
    this.customExamples.set('User', [
      {
        summary: 'Regular User',
        description: 'A standard user account',
        value: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'john.doe@fundshield.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'user',
          isActive: true,
          createdAt: '2024-01-15T10:30:00Z',
          updatedAt: '2024-01-15T10:30:00Z',
        },
      },
      {
        summary: 'Admin User',
        description: 'An administrator account with elevated privileges',
        value: {
          id: '456e7890-e89b-12d3-a456-426614174001',
          email: 'admin@fundshield.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          isActive: true,
          createdAt: '2024-01-01T08:00:00Z',
          updatedAt: '2024-01-15T10:30:00Z',
        },
      },
    ]);

    // Login examples
    this.customExamples.set('Login', [
      {
        summary: 'Email/Password Login',
        description: 'Standard login with email and password',
        value: {
          email: 'user@fundshield.com',
          password: 'SecurePassword123!',
        },
      },
      {
        summary: 'Two-Factor Authentication',
        description: 'Login with 2FA token',
        value: {
          email: 'user@fundshield.com',
          password: 'SecurePassword123!',
          twoFactorToken: '123456',
        },
      },
    ]);

    // Fund examples
    this.customExamples.set('Fund', [
      {
        summary: 'Technology Fund',
        description: 'A fund focused on technology investments',
        value: {
          name: 'Tech Innovation Fund',
          description: 'Investing in cutting-edge technology companies',
          totalValue: 5000000.0,
          currency: 'USD',
          managerId: '789e1011-e89b-12d3-a456-426614174002',
          status: 'active',
        },
      },
    ]);

    // Error examples
    this.customExamples.set('Error', [
      {
        summary: 'Validation Error',
        description: 'Error response for validation failures',
        value: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: {
              fields: ['email', 'password'],
              violations: [
                { field: 'email', message: 'Email is required' },
                {
                  field: 'password',
                  message: 'Password must be at least 8 characters',
                },
              ],
            },
          },
          metadata: {
            version: 'v1',
            timestamp: '2024-01-15T10:30:00Z',
            requestId: 'req_1234567890_abcdef',
            responseTime: 45,
          },
        },
      },
      {
        summary: 'Unauthorized Error',
        description: 'Error response for unauthorized access',
        value: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            details: {
              reason: 'Invalid or expired token',
            },
          },
          metadata: {
            version: 'v1',
            timestamp: '2024-01-15T10:30:00Z',
            requestId: 'req_1234567890_abcdef',
            responseTime: 12,
          },
        },
      },
    ]);

    this.logger.log(
      `Initialized examples for ${this.customExamples.size} entities`,
    );
  }

  /**
   * Setup comprehensive Swagger documentation
   */
  setupSwagger(app: INestApplication, options?: Partial<SwaggerOptions>): void {
    const swaggerConfig = this.config.swagger;
    const opts: SwaggerOptions = {
      title: swaggerConfig.title,
      description: swaggerConfig.description,
      version: swaggerConfig.version,
      path: 'docs',
      enableVersioning: true,
      enableExamples: true,
      enableSchemas: true,
      enableSecurity: true,
      ...options,
    };

    // Create main documentation
    const config = new DocumentBuilder()
      .setTitle(opts.title)
      .setDescription(opts.description)
      .setVersion(opts.version)
      .setContact(
        swaggerConfig.contact.name,
        swaggerConfig.contact.url,
        swaggerConfig.contact.email,
      )
      .setLicense(swaggerConfig.license.name, swaggerConfig.license.url)
      .setExternalDoc('API Guide', 'https://docs.fundshield.com');

    // Add servers
    swaggerConfig.servers.forEach(server => {
      config.addServer(server.url, server.description);
    });

    // Add security schemes
    if (opts.enableSecurity) {
      config
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT authorization token',
          },
          'JWT',
        )
        .addApiKey(
          {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
            description: 'API key for service-to-service authentication',
          },
          'ApiKey',
        )
        .addSecurityRequirements('JWT')
        .addSecurityRequirements('ApiKey');
    }

    // Add tags
    swaggerConfig.tags.forEach(tag => {
      if (tag.externalDocs) {
        config.addTag(tag.name, tag.description, tag.externalDocs);
      } else {
        config.addTag(tag.name, tag.description);
      }
    });

    // Build document
    const document = SwaggerModule.createDocument(app, config.build());

    // Add custom schemas
    if (opts.enableSchemas) {
      this.addCustomSchemas(document);
    }

    // Add examples
    if (opts.enableExamples) {
      this.addCustomExamplesToDocument(document);
    }

    // Add version-specific paths
    if (opts.enableVersioning) {
      this.addVersioningSupport(document);
    }

    // Setup Swagger UI
    SwaggerModule.setup(opts.path, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        requestInterceptor: this.createRequestInterceptor(),
        responseInterceptor: this.createResponseInterceptor(),
      },
      customSiteTitle: 'FundShield API Documentation',
      customfavIcon: '/favicon.ico',
      customCss: this.getCustomCSS(),
      customJs: this.getCustomJS(),
    });

    this.logger.log(`Swagger documentation setup at /${opts.path}`);
  }

  /**
   * Add custom schemas to Swagger document
   */
  private addCustomSchemas(document: OpenAPIObject): void {
    if (!document.components) {
      document.components = {};
    }
    if (!document.components.schemas) {
      document.components.schemas = {};
    }

    this.customSchemas.forEach((schemaInfo, name) => {
      document.components.schemas[name] = schemaInfo.schema;
    });

    this.logger.debug(
      `Added ${this.customSchemas.size} custom schemas to documentation`,
    );
  }

  /**
   * Add custom examples to Swagger document
   */
  private addCustomExamplesToDocument(document: OpenAPIObject): void {
    if (!document.components) {
      document.components = {};
    }
    if (!document.components.examples) {
      document.components.examples = {};
    }

    this.customExamples.forEach((examples, entityName) => {
      examples.forEach((example, index) => {
        const exampleName = `${entityName}Example${index + 1}`;
        document.components.examples[exampleName] = {
          summary: example.summary,
          description: example.description,
          value: example.value,
        };
      });
    });

    this.logger.debug(
      `Added examples for ${this.customExamples.size} entities to documentation`,
    );
  }

  /**
   * Add versioning support to Swagger document
   */
  private addVersioningSupport(document: OpenAPIObject): void {
    // Add version parameter to all paths
    if (document.paths) {
      Object.keys(document.paths).forEach(path => {
        const pathItem = document.paths[path];
        if (pathItem) {
          ['get', 'post', 'put', 'patch', 'delete'].forEach(method => {
            if (pathItem[method]) {
              if (!pathItem[method].parameters) {
                pathItem[method].parameters = [];
              }

              // Add version header parameter
              pathItem[method].parameters.push({
                name: 'X-API-Version',
                in: 'header',
                description: 'API version',
                required: false,
                schema: {
                  type: 'string',
                  enum: ['v1', 'v2'],
                  default: 'v1',
                },
                example: 'v1',
              });
            }
          });
        }
      });
    }

    this.logger.debug('Added versioning support to documentation');
  }

  /**
   * Create request interceptor for Swagger UI
   */
  private createRequestInterceptor(): string {
    return `
      function(request) {
        // Add request timestamp
        request.headers['X-Request-Timestamp'] = new Date().toISOString();
        
        // Add request ID for tracing
        request.headers['X-Request-ID'] = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Log request for debugging
        console.log('API Request:', request);
        
        return request;
      }
    `;
  }

  /**
   * Create response interceptor for Swagger UI
   */
  private createResponseInterceptor(): string {
    return `
      function(response) {
        // Log response for debugging
        console.log('API Response:', response);
        
        // Add response timing information
        if (response.headers['x-response-time']) {
          console.log('Response Time:', response.headers['x-response-time']);
        }
        
        return response;
      }
    `;
  }

  /**
   * Get custom CSS for Swagger UI
   */
  private getCustomCSS(): string {
    return `
      .swagger-ui .topbar { 
        background-color: #1e3a8a; 
      }
      .swagger-ui .topbar-wrapper .link {
        content: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20"><text y="15" font-family="Arial" font-size="14" fill="white">FundShield API</text></svg>');
      }
      .swagger-ui .scheme-container {
        background: linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%);
        border-radius: 4px;
        padding: 10px;
      }
      .swagger-ui .info {
        margin: 50px 0;
      }
      .swagger-ui .info .title {
        color: #1e3a8a;
      }
      .swagger-ui .opblock.opblock-get {
        border-color: #10b981;
        background: rgba(16, 185, 129, 0.1);
      }
      .swagger-ui .opblock.opblock-post {
        border-color: #3b82f6;
        background: rgba(59, 130, 246, 0.1);
      }
      .swagger-ui .opblock.opblock-put {
        border-color: #f59e0b;
        background: rgba(245, 158, 11, 0.1);
      }
      .swagger-ui .opblock.opblock-delete {
        border-color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
      }
    `;
  }

  /**
   * Get custom JavaScript for Swagger UI
   */
  private getCustomJS(): string {
    return `
      window.onload = function() {
        // Add version selector
        const topbar = document.querySelector('.topbar-wrapper');
        if (topbar) {
          const versionSelector = document.createElement('select');
          versionSelector.innerHTML = '<option value="v1">API v1</option><option value="v2">API v2</option>';
          versionSelector.style.marginLeft = '20px';
          versionSelector.style.padding = '5px';
          versionSelector.onchange = function() {
            // Update all version headers in the UI
            console.log('Version changed to:', this.value);
          };
          topbar.appendChild(versionSelector);
        }
        
        // Add API status indicator
        fetch('/health')
          .then(response => response.ok ? 'healthy' : 'unhealthy')
          .catch(() => 'unknown')
          .then(status => {
            const indicator = document.createElement('div');
            indicator.innerHTML = \`API Status: <span style="color: \${status === 'healthy' ? 'green' : 'red'}">\${status.toUpperCase()}</span>\`;
            indicator.style.position = 'fixed';
            indicator.style.top = '10px';
            indicator.style.right = '10px';
            indicator.style.background = 'white';
            indicator.style.padding = '5px 10px';
            indicator.style.borderRadius = '4px';
            indicator.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            indicator.style.fontSize = '12px';
            document.body.appendChild(indicator);
          });
      }
    `;
  }

  /**
   * Get custom schema by name
   */
  getCustomSchema(name: string): ApiSchema | undefined {
    return this.customSchemas.get(name);
  }

  /**
   * Get custom examples by entity name
   */
  getCustomExamples(entityName: string): ApiExample[] | undefined {
    return this.customExamples.get(entityName);
  }

  /**
   * Add new custom schema
   */
  addCustomSchema(schema: ApiSchema): void {
    this.customSchemas.set(schema.name, schema);
    this.logger.log(`Added custom schema: ${schema.name}`);
  }

  /**
   * Add new custom examples
   */
  addCustomExamples(entityName: string, examples: ApiExample[]): void {
    this.customExamples.set(entityName, examples);
    this.logger.log(`Added custom examples for: ${entityName}`);
  }
}
