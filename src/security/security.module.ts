import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { SecurityService } from './security.service';
import { SecurityGuard } from './security.guard';
import { SecurityInterceptor } from './security.interceptor';
import { ApiKeyGuard } from './api-key.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { ValidationPipe } from './pipes/validation.pipe';
import { SanitizePipe } from './pipes/sanitize.pipe';

@Module({
  providers: [
    SecurityService,
    { provide: APP_GUARD, useClass: SecurityGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: SecurityInterceptor },
    { provide: APP_PIPE, useClass: ValidationPipe },
    { provide: APP_PIPE, useClass: SanitizePipe },
  ],
  exports: [SecurityService, SecurityGuard, ApiKeyGuard, RateLimitGuard, ValidationPipe, SanitizePipe],
})
export class SecurityModule {} 