import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import { BullModule } from '@nestjs/bull';
import { HealthController } from './controllers/health.controller';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AuthModule } from './auth/auth.module';
import { CryptoModule } from './crypto/crypto.module';
import { ApiGatewayModule } from './api-gateway/api-gateway.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SecurityModule } from './security/security.module';
import { UserModule } from './user/user.module';
import { EscrowModule } from './escrow/escrow.module';
import { NotificationModule } from './notification/notification.module';
import { DisputeModule } from './dispute/dispute.module';
import { DevelopersModule } from './developers/developers.module';
import { databaseConfig } from './config/database.config';
import { createLogger } from './config/logger.config';
import { validationSchema } from './config/validation.config';
import { AuditModule } from './audit/audit.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit/audit.interceptor';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),

    // Redis/Bull Queue
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Logging
    WinstonModule.forRoot({
      instance: createLogger(),
    }),

    // Modules
    ApiGatewayModule,
    AnalyticsModule,
    SecurityModule,
    BlockchainModule,
    AuditModule,
    AuthModule,
    CryptoModule,
    UserModule,
    EscrowModule,
    NotificationModule,
    DisputeModule,
    DevelopersModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
