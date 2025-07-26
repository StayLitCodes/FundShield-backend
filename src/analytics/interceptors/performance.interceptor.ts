import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from "@nestjs/common"
import type { Observable } from "rxjs"
import { tap } from "rxjs/operators"
import type { AnalyticsService } from "../services/analytics.service"
import { MetricType } from "../enums/metric-type.enum"

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(private analyticsService: AnalyticsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now()
    const startMemory = process.memoryUsage()

    return next.handle().pipe(
      tap(async () => {
        const endTime = Date.now()
        const endMemory = process.memoryUsage()
        const responseTime = endTime - startTime
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed

        const request = context.switchToHttp().getRequest()
        const response = context.switchToHttp().getResponse()

        // Record performance metrics
        await this.analyticsService.recordMetric({
          type: MetricType.HISTOGRAM,
          name: "api_response_time",
          value: responseTime,
          metadata: {
            endpoint: request.route?.path || request.url,
            method: request.method,
            statusCode: response.statusCode,
            memoryDelta,
          },
        })

        await this.analyticsService.recordMetric({
          type: MetricType.GAUGE,
          name: "memory_usage",
          value: endMemory.heapUsed,
          metadata: {
            endpoint: request.route?.path || request.url,
            delta: memoryDelta,
          },
        })
      }),
    )
  }
}
