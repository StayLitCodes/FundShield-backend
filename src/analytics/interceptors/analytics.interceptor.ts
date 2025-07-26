import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from "@nestjs/common"
import type { Observable } from "rxjs"
import { tap } from "rxjs/operators"
import type { MetricsCollectionService } from "../services/metrics-collection.service"

@Injectable()
export class AnalyticsInterceptor implements NestInterceptor {
  constructor(private metricsCollectionService: MetricsCollectionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const startTime = Date.now()

    return next.handle().pipe(
      tap(async () => {
        const endTime = Date.now()
        const responseTime = endTime - startTime

        // Record API call metric
        await this.metricsCollectionService.recordPerformanceMetric({
          endpoint: request.route?.path || request.url,
          method: request.method,
          responseTime,
          statusCode: context.switchToHttp().getResponse().statusCode,
          userId: request.user?.id,
          userAgent: request.headers["user-agent"],
          metadata: {
            ip: request.ip,
            timestamp: new Date(startTime),
          },
        })
      }),
    )
  }
}
