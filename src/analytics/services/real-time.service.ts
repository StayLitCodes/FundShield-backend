import { Injectable, Logger } from "@nestjs/common"
import type { AnalyticsGateway } from "../gateways/analytics.gateway"
import type { Metric } from "../entities/metric.entity"

@Injectable()
export class RealTimeService {
  private readonly logger = new Logger(RealTimeService.name)
  private currentMetrics: Map<string, any> = new Map()

  constructor(private analyticsGateway: AnalyticsGateway) {}

  async broadcastMetricUpdate(metric: Metric): Promise<void> {
    // Update current metrics cache
    this.updateCurrentMetrics(metric)

    // Broadcast to connected clients
    await this.analyticsGateway.broadcastMetricUpdate({
      type: metric.type,
      name: metric.name,
      value: metric.value,
      timestamp: metric.timestamp,
      metadata: metric.metadata,
    })

    this.logger.debug(`Broadcasted metric update: ${metric.name}`)
  }

  async broadcastKpiUpdate(kpi: any): Promise<void> {
    await this.analyticsGateway.broadcastKpiUpdate({
      name: kpi.name,
      value: kpi.value,
      target: kpi.target,
      variance: kpi.variance,
      category: kpi.category,
      timestamp: kpi.timestamp,
    })

    this.logger.debug(`Broadcasted KPI update: ${kpi.name}`)
  }

  getCurrentMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {}

    for (const [key, value] of this.currentMetrics.entries()) {
      metrics[key] = value
    }

    return metrics
  }

  private updateCurrentMetrics(metric: Metric): void {
    const key = `${metric.name}_${metric.type}`
    const existing = this.currentMetrics.get(key)

    if (!existing || metric.timestamp > existing.timestamp) {
      this.currentMetrics.set(key, {
        name: metric.name,
        type: metric.type,
        value: metric.value,
        timestamp: metric.timestamp,
        metadata: metric.metadata,
      })
    }

    // Keep only recent metrics (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    for (const [key, value] of this.currentMetrics.entries()) {
      if (value.timestamp < oneHourAgo) {
        this.currentMetrics.delete(key)
      }
    }
  }
}
