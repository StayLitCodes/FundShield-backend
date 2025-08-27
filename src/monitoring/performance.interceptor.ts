import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PerformanceMetricsService } from './performance-metrics.service';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: PerformanceMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = process.hrtime.bigint();
    const req = context.switchToHttp().getRequest();
  const route = req?.route?.path || req?.url;
  const user = req?.user?.id || null;
  const ip = req?.ip || req?.headers['x-forwarded-for'] || req?.connection?.remoteAddress;
    return next.handle().pipe(
      tap(() => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - now) / 1e6;
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        this.metricsService.recordRequest({
          route,
          durationMs,
          memoryUsage,
          cpuUsage,
          user,
          ip,
        });
      }),
    );
  }
}
