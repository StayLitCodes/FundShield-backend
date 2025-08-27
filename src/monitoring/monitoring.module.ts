import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
import { PerformanceInterceptor } from './performance.interceptor';
import { PerformanceMetricsService } from './performance-metrics.service';
import { RedisCacheInterceptor } from './redis-cache.interceptor';
import { QueryPerformanceSubscriber } from './query-performance.subscriber';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          url: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
        }),
        ttl: 60, // default cache TTL in seconds
      }),
    }),
  ],
  providers: [PerformanceInterceptor, PerformanceMetricsService, RedisCacheInterceptor, QueryPerformanceSubscriber],
  exports: [PerformanceInterceptor, PerformanceMetricsService, RedisCacheInterceptor, QueryPerformanceSubscriber],
})
export class MonitoringModule {}
