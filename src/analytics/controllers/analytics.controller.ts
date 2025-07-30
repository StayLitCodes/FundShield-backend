import { Controller } from "@nestjs/common"
import type { AnalyticsService } from "../services/analytics.service"
import type { MetricsCollectionService } from "../services/metrics-collection.service"
import type { CreateMetricDto } from "../dto/create-metric.dto"
import type { BulkMetricsDto } from "../dto/bulk-metrics.dto"
import type { AnalyticsQueryDto } from "../dto/analytics-query.dto"
import type { CreateUserEngagementDto } from "../dto/create-user-engagement.dto"

@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly metricsCollectionService: MetricsCollectionService,
  ) {}

  recordMetric(createMetricDto: CreateMetricDto) {
    return this.analyticsService.recordMetric(createMetricDto)
  }

  recordBulkMetrics(bulkMetricsDto: BulkMetricsDto) {
    return this.analyticsService.recordBulkMetrics(bulkMetricsDto)
  }

  getMetrics(query: AnalyticsQueryDto) {
    return this.analyticsService.getMetrics(query)
  }

  getMetricsByType(type: string, query: AnalyticsQueryDto) {
    return this.analyticsService.getMetricsByType(type, query)
  }

  getMetricSummary(query: AnalyticsQueryDto) {
    return this.analyticsService.getMetricSummary(query)
  }

  getRealtimeMetrics() {
    return this.analyticsService.getRealtimeMetrics()
  }

  recordUserEngagement(engagementDto: CreateUserEngagementDto) {
    return this.metricsCollectionService.recordUserEngagement(engagementDto)
  }

  recordTransactionMetric(data: any) {
    return this.metricsCollectionService.recordTransactionMetric(data)
  }

  recordEscrowMetric(data: any) {
    return this.metricsCollectionService.recordEscrowMetric(data)
  }

  recordDisputeMetric(data: any) {
    return this.metricsCollectionService.recordDisputeMetric(data)
  }

  recordRevenueMetric(data: any) {
    return this.metricsCollectionService.recordRevenueMetric(data)
  }

  recordPerformanceMetric(data: any) {
    return this.metricsCollectionService.recordPerformanceMetric(data)
  }
}
