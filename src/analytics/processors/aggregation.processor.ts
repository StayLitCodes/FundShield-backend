import { Process, Processor } from "@nestjs/bull"
import type { Job } from "bull"
import { Logger } from "@nestjs/common"
import type { AggregationService } from "../services/aggregation.service"
import type { KpiService } from "../services/kpi.service"

@Processor("aggregation-queue")
export class AggregationProcessor {
  private readonly logger = new Logger(AggregationProcessor.name)

  constructor(
    private aggregationService: AggregationService,
    private kpiService: KpiService,
  ) {}

  @Process("calculate-aggregations")
  async handleCalculateAggregations(job: Job) {
    const { metricName, timeRange } = job.data

    try {
      this.logger.log(`Calculating aggregations for: ${metricName}`)

      // Calculate time series aggregations
      const timeSeries = await this.aggregationService.getTimeSeriesAggregation(
        metricName,
        "hour",
        timeRange.startDate,
        timeRange.endDate,
      )

      // Update KPIs if applicable
      if (this.isKpiMetric(metricName)) {
        await this.updateKpiFromAggregation(metricName, timeSeries)
      }

      this.logger.log(`Aggregations calculated successfully for: ${metricName}`)
    } catch (error) {
      this.logger.error(`Failed to calculate aggregations for ${metricName}:`, error)
      throw error
    }
  }

  private isKpiMetric(metricName: string): boolean {
    const kpiMetrics = ["transaction_volume", "revenue_total", "user_engagement"]
    return kpiMetrics.some((kpi) => metricName.includes(kpi))
  }

  private async updateKpiFromAggregation(metricName: string, timeSeries: any[]): Promise<void> {
    if (timeSeries.length === 0) return

    const latestValue = timeSeries[timeSeries.length - 1].value

    let kpiName: string
    let target: number
    let unit: string
    let category: string

    if (metricName.includes("transaction_volume")) {
      kpiName = "hourly_transaction_volume"
      target = 10000
      unit = "USD"
      category = "transactions"
    } else if (metricName.includes("revenue_total")) {
      kpiName = "hourly_revenue"
      target = 1000
      unit = "USD"
      category = "revenue"
    } else if (metricName.includes("user_engagement")) {
      kpiName = "hourly_user_engagement"
      target = 100
      unit = "engagements"
      category = "engagement"
    } else {
      return
    }

    await this.kpiService.recordKpi({
      name: kpiName,
      value: latestValue,
      target,
      unit,
      category,
      metadata: { source: "aggregation", metricName },
    })
  }
}
