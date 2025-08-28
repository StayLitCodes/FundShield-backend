import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import { createLogger } from './config/logger.config';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerConfigService } from './api-gateway/services/swagger-config.service';

async function bootstrap() {
  const logger = createLogger();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger({
      instance: logger,
    }),
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API prefix
  app.setGlobalPrefix(apiPrefix);

  // CORS configuration
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production' ? ['https://fundshield.com'] : true,
    credentials: true,
  });

  // Enhanced Swagger documentation with API Gateway features
  if (process.env.NODE_ENV !== 'production') {
    try {
      const swaggerService = app.get(SwaggerConfigService);
      swaggerService.setupSwagger(app, {
        title: 'FundShield API Gateway',
        description: 'Comprehensive API with versioning, analytics, and security',
        version: '1.0.0',
        path: `${apiPrefix}/docs`,
        enableVersioning: true,
        enableExamples: true,
        enableSchemas: true,
        enableSecurity: true,
      });
      
      logger.info(`📚 Enhanced API Documentation: http://localhost:${port}/${apiPrefix}/docs`);
      logger.info(`🔧 API Explorer: http://localhost:${port}/${apiPrefix}/gateway/explore`);
    } catch (error) {
      // Fallback to basic Swagger if enhanced setup fails
      logger.warn('Enhanced Swagger setup failed, using basic configuration');
      
      const config = new DocumentBuilder()
        .setTitle('FundShield API')
        .setDescription('FundShield Backend API Documentation')
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('auth', 'Authentication endpoints')
        .addTag('users', 'User management')
        .addTag('funds', 'Fund management')
        .addTag('transactions', 'Transaction handling')
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
      
      logger.info(`📚 API Documentation: http://localhost:${port}/${apiPrefix}/docs`);
    }
  }

  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads/' });

  await app.listen(port);
  logger.info(`🚀 FundShield Backend running on port ${port}`);
  logger.info(`🛡️  API Gateway enabled with versioning, analytics, and security`);
  logger.info(`📊 Gateway Health: http://localhost:${port}/${apiPrefix}/gateway/health`);
  logger.info(`📈 Gateway Metrics: http://localhost:${port}/${apiPrefix}/gateway/metrics`);
  if (process.env.NODE_ENV !== 'production') {
    logger.info(
      `📚 API Documentation: http://localhost:${port}/${apiPrefix}/docs`,
    );
  }
}

bootstrap().catch(error => {
  console.error('❌ Error starting server:', error);
  process.exit(1);
});
