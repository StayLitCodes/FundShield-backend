import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

// Controllers
import { ApiGatewayController } from './controllers/api-gateway.controller';
import { VersioningController } from './controllers/versioning.controller';

// Services
import { ApiGatewayService } from './services/api-gateway.service';
import { VersioningService } from './services/versioning.service';
import { RouteService } from './services/route.service';
import { TransformationService } from './services/transformation.service';
// Guards
import { ApiVersionGuard } from './guards/api-version.guard';
import { AdvancedRateLimitGuard } from './guards/advanced-rate-limit.guard';

// Interceptors
import { ResponseTransformInterceptor } from './interceptors/response-transform.interceptor';
import { ApiAnalyticsInterceptor } from './interceptors/api-analytics.interceptor';
import { SecurityHeadersInterceptor } from './interceptors/security-headers.interceptor';

// Pipes
import { RequestTransformPipe } from './pipes/request-transform.pipe';
import { ApiVersionPipe } from './pipes/api-version.pipe';

// Configuration
import { apiGatewayConfig } from './config/api-gateway.config';

@Module({
  imports: [
    ConfigModule.forFeature(apiGatewayConfig),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 100,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 1000,
      },
    ]),
  ],
  controllers: [ApiGatewayController, VersioningController],
  providers: [
    // Services
    ApiGatewayService,
    VersioningService,
    RouteService,
    TransformationService,

    // Guards
    {
      provide: APP_GUARD,
      useClass: ApiVersionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AdvancedRateLimitGuard,
    },

    // Interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiAnalyticsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SecurityHeadersInterceptor,
    },

    // Pipes
    {
      provide: APP_PIPE,
      useClass: RequestTransformPipe,
    },
    {
      provide: APP_PIPE,
      useClass: ApiVersionPipe,
    },
  ],
  exports: [
    ApiGatewayService,
    VersioningService,
    RouteService,
    TransformationService,
    ResponseTransformInterceptor,
    ApiAnalyticsInterceptor,
    SecurityHeadersInterceptor,
  ],
})
export class ApiGatewayModule {}
