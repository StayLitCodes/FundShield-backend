import { registerAs } from '@nestjs/config';

export interface ApiGatewayConfig {
  versioning: {
    type: 'uri' | 'header' | 'media-type' | 'custom';
    defaultVersion: string;
    header?: string;
    key?: string;
    extractor?: (request: any) => string;
  };

  rateLimit: {
    global: {
      ttl: number;
      limit: number;
    };
    perEndpoint: Record<string, { ttl: number; limit: number }>;
  };

  cors: {
    origin: string[] | boolean;
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };

  security: {
    helmet: {
      contentSecurityPolicy: boolean;
      crossOriginEmbedderPolicy: boolean;
      crossOriginOpenerPolicy: boolean;
      crossOriginResourcePolicy: boolean | { policy: string };
      dnsPrefetchControl: boolean;
      frameguard: boolean | { action: string };
      hidePoweredBy: boolean;
      hsts: boolean;
      ieNoOpen: boolean;
      noSniff: boolean;
      originAgentCluster: boolean;
      permittedCrossDomainPolicies: boolean;
      referrerPolicy: boolean | { policy: string };
      xssFilter: boolean;
    };
    customHeaders: Record<string, string>;
  };

  swagger: {
    title: string;
    description: string;
    version: string;
    servers: Array<{
      url: string;
      description: string;
    }>;
    tags: Array<{
      name: string;
      description: string;
      externalDocs?: {
        description: string;
        url: string;
      };
    }>;
    contact: {
      name: string;
      url: string;
      email: string;
    };
    license: {
      name: string;
      url: string;
    };
  };

  analytics: {
    enabled: boolean;
    trackHeaders: boolean;
    trackUserAgent: boolean;
    trackIP: boolean;
    exclusions: string[];
    sampling: number;
  };

  transformation: {
    request: {
      enabled: boolean;
      removeFields: string[];
      sanitize: boolean;
    };
    response: {
      enabled: boolean;
      wrapResponse: boolean;
      includeMetadata: boolean;
      standardizeErrors: boolean;
    };
  };
}

export const apiGatewayConfig = registerAs(
  'apiGateway',
  (): ApiGatewayConfig => ({
    versioning: {
      type:
        (process.env.API_VERSIONING_TYPE as
          | 'uri'
          | 'header'
          | 'media-type'
          | 'custom') || 'uri',
      defaultVersion: process.env.API_DEFAULT_VERSION || 'v1',
      header: process.env.API_VERSION_HEADER || 'X-API-Version',
      key: process.env.API_VERSION_KEY || 'version',
    },

    rateLimit: {
      global: {
        ttl: parseInt(process.env.RATE_LIMIT_TTL) || 60000,
        limit: parseInt(process.env.RATE_LIMIT_MAX) || 100,
      },
      perEndpoint: {
        '/auth/login': { ttl: 60000, limit: 5 },
        '/auth/register': { ttl: 300000, limit: 3 },
        '/auth/forgot-password': { ttl: 300000, limit: 3 },
        '/analytics': { ttl: 60000, limit: 200 },
      },
    },

    cors: {
      origin:
        process.env.NODE_ENV === 'production'
          ? process.env.CORS_ORIGINS?.split(',') || ['https://fundshield.com']
          : true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-API-Version',
        'X-API-Key',
        'X-Request-ID',
        'Accept',
        'Origin',
      ],
      credentials: true,
      maxAge: 86400, // 24 hours
    },

    security: {
      helmet: {
        contentSecurityPolicy: process.env.NODE_ENV === 'production',
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        dnsPrefetchControl: true,
        frameguard: { action: 'deny' },
        hidePoweredBy: true,
        hsts: process.env.NODE_ENV === 'production',
        ieNoOpen: true,
        noSniff: true,
        originAgentCluster: true,
        permittedCrossDomainPolicies: false,
        referrerPolicy: { policy: 'no-referrer' },
        xssFilter: true,
      },
      customHeaders: {
        'X-API-Version': process.env.API_DEFAULT_VERSION || 'v1',
        'X-Response-Time': 'true',
        'X-RateLimit-Limit': 'true',
        'X-RateLimit-Remaining': 'true',
        'X-RateLimit-Reset': 'true',
      },
    },

    swagger: {
      title: 'FundShield API Gateway',
      description: `
      ## FundShield Backend API Documentation
      
      Welcome to the comprehensive API documentation for FundShield - a secure fund management and escrow platform.
      
      ### Features
      - 🔐 **Authentication & Authorization**: JWT-based auth with role-based access control
      - 💰 **Fund Management**: Complete lifecycle management of funds and transactions
      - 🔒 **Escrow Services**: Secure escrow transactions with dispute resolution
      - 📊 **Analytics**: Real-time analytics and reporting
      - 🛡️ **Security**: Enterprise-grade security with audit trails
      - ⚡ **Performance**: Optimized for high-throughput operations
      
      ### API Versioning
      This API supports versioning through URI path (e.g., /api/v1, /api/v2) and header-based versioning.
      
      ### Rate Limiting
      API requests are rate-limited to ensure fair usage and system stability.
      
      ### Error Handling
      All errors follow a consistent structure with appropriate HTTP status codes and detailed error messages.
    `,
      version: '1.0.0',
      servers: [
        {
          url: process.env.API_BASE_URL || 'http://localhost:3000',
          description: 'Development server',
        },
        {
          url: 'https://api.fundshield.com',
          description: 'Production server',
        },
      ],
      tags: [
        {
          name: 'Authentication',
          description: 'User authentication and authorization endpoints',
          externalDocs: {
            description: 'Learn more about authentication',
            url: 'https://docs.fundshield.com/auth',
          },
        },
        {
          name: 'Users',
          description: 'User management and profile operations',
        },
        {
          name: 'Funds',
          description: 'Fund creation, management, and operations',
        },
        {
          name: 'Escrow',
          description: 'Escrow transaction management and dispute resolution',
        },
        {
          name: 'Analytics',
          description: 'Analytics, reporting, and metrics endpoints',
        },
        {
          name: 'Crypto',
          description: 'Cryptocurrency and blockchain integration',
        },
        {
          name: 'Notifications',
          description: 'Notification management and delivery',
        },
        {
          name: 'Configuration',
          description: 'System configuration and feature flags',
        },
        {
          name: 'Health',
          description: 'System health and monitoring endpoints',
        },
      ],
      contact: {
        name: 'FundShield API Support',
        url: 'https://fundshield.com/support',
        email: 'api-support@fundshield.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },

    analytics: {
      enabled: process.env.API_ANALYTICS_ENABLED !== 'false',
      trackHeaders: true,
      trackUserAgent: true,
      trackIP: process.env.NODE_ENV !== 'production',
      exclusions: ['/health', '/metrics', '/docs'],
      sampling: parseFloat(process.env.API_ANALYTICS_SAMPLING) || 1.0,
    },

    transformation: {
      request: {
        enabled: process.env.REQUEST_TRANSFORM_ENABLED !== 'false',
        removeFields: ['password', 'secret', 'token'],
        sanitize: true,
      },
      response: {
        enabled: process.env.RESPONSE_TRANSFORM_ENABLED !== 'false',
        wrapResponse: true,
        includeMetadata: true,
        standardizeErrors: true,
      },
    },
  }),
);
