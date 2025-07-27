import { Process, Processor } from "@nestjs/bull"
import type { Job } from "bull"
import { Logger } from "@nestjs/common"
import type { RealTimeService } from "../services/real-time.service"
import type { AggregationService } from "../services/aggregation.service"

@Processor("metrics-queue")
export class MetricsProcessor {
  private readonly logger = new Logger(MetricsProcessor.name)

  constructor(
    private realTimeService: RealTimeService,
    private aggregationService: AggregationService,
  ) {}

  @Process("process-metric")
  async handleProcessMetric(job: Job) {
    const { metricId, metric } = job.data

    try {
      this.logger.log(`Processing metric: ${metricId}`)

      // Update real-time metrics
      await this.realTimeService.broadcastMetricUpdate(metric)

      // Trigger aggregations if needed
      if (this.shouldTriggerAggregation(metric)) {
        // Add aggregation job
        // This would typically be handled by a separate aggregation queue
      }

      this.logger.log(`Metric processed successfully: ${metricId}`)
    } catch (error) {
      this.logger.error(`Failed to process metric ${metricId}:`, error)
      throw error
    }
  }

  @Process("process-bulk-metrics")
  async handleProcessBulkMetrics(job: Job) {
    const { metrics } = job.data

    try {
      this.logger.log(`Processing bulk metrics: ${metrics.length} items`)

      // Process each metric
      for (const metric of metrics) {
        await this.realTimeService.broadcastMetricUpdate(metric)
      }

      this.logger.log(`Bulk metrics processed successfully: ${metrics.length} items`)
    } catch (error) {
      this.logger.error("Failed to process bulk metrics:", error)
      throw error
    }
  }

  private shouldTriggerAggregation(metric: any): boolean {
    // Define conditions for triggering aggregations
    const aggregationTriggers = ["transaction_volume", "revenue_total", "user_engagement"]
    return aggregationTriggers.includes(metric.name)
  }
}
