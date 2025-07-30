import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from "@nestjs/common"
import type { Observable } from "rxjs"
import { tap } from "rxjs/operators"
import type { MetricsCollectionService } from "../services/metrics-collection.service"
import { EngagementType } from "../enums/engagement-type.enum"

@Injectable()
export class UserEngagementInterceptor implements NestInterceptor {
  constructor(private metricsCollectionService: MetricsCollectionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()

    return next.handle().pipe(
      tap(async () => {
        const userId = request.user?.id

        if (userId) {
          // Record user engagement
          await this.metricsCollectionService.recordUserEngagement({
            userId,
            type: this.getEngagementType(request.method, request.route?.path),
            action: `${request.method} ${request.route?.path || request.url}`,
            page: request.route?.path,
            sessionId: request.sessionID,
            userAgent: request.headers["user-agent"],
            ipAddress: request.ip,
            metadata: {
              statusCode: context.switchToHttp().getResponse().statusCode,
              timestamp: new Date(),
            },
          })
        }
      }),
    )
  }

  private getEngagementType(method: string, path?: string): EngagementType {
    if (method === "GET") {
      return EngagementType.PAGE_VIEW
    }

    if (method === "POST") {
      if (path?.includes("search")) {
        return EngagementType.SEARCH
      }
      if (path?.includes("download")) {
        return EngagementType.DOWNLOAD
      }
      if (path?.includes("share")) {
        return EngagementType.SHARE
      }
      if (path?.includes("login")) {
        return EngagementType.LOGIN
      }
      if (path?.includes("logout")) {
        return EngagementType.LOGOUT
      }
      if (path?.includes("purchase") || path?.includes("order")) {
        return EngagementType.PURCHASE
      }
      return EngagementType.FORM_SUBMIT
    }

    return EngagementType.CUSTOM
  }
}
