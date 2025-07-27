import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { KpiMetric } from "../entities/kpi-metric.entity"
import type { AnalyticsService } from "./analytics.service"
import { Cron, CronExpression } from "@nestjs/schedule"

@Injectable()
export class KpiService {
  private readonly logger = new Logger(KpiService.name)

  constructor(
    private kpiMetricRepository: Repository<KpiMetric>,
    private analyticsService: AnalyticsService,
  ) {}

  async recordKpi(data: {
    name: string
    value: number
    target?: number
    unit: string
    category: string
    metadata?: Record<string, any>
  }): Promise<KpiMetric> {
    const variance = data.target ? ((data.value - data.target) / data.target) * 100 : null

    const kpi = this.kpiMetricRepository.create({
      ...data,
      variance,
      timestamp: new Date(),
    })

    return this.kpiMetricRepository.save(kpi)
  }

  async getKpis(category?: string, startDate?: Date, endDate?: Date): Promise<KpiMetric[]> {
    const queryBuilder = this.kpiMetricRepository.createQueryBuilder("kpi")

    if (category) {
      queryBuilder.where("kpi.category = :category", { category })
    }

    if (startDate) {
      queryBuilder.andWhere("kpi.timestamp >= :startDate", { startDate })
    }

    if (endDate) {
      queryBuilder.andWhere("kpi.timestamp <= :endDate", { endDate })
    }

    return queryBuilder.orderBy("kpi.timestamp", "DESC").getMany()
  }

  async getKpiSummary(): Promise<Record<string, any>> {
    const kpis = await this.kpiMetricRepository.find({
      order: { timestamp: "DESC" },
    })

    const summary: Record<string, any> = {}

    // Group by category
    const categories = [...new Set(kpis.map((kpi) => kpi.category))]

    for (const category of categories) {
      const categoryKpis = kpis.filter((kpi) => kpi.category === category)
      const latestKpis = this.getLatestKpisByName(categoryKpis)

      summary[category] = {
        total: categoryKpis.length,
        kpis: latestKpis.map((kpi) => ({
          name: kpi.name,
          value: kpi.value,
          target: kpi.target,
          variance: kpi.variance,
          unit: kpi.unit,
          status: this.getKpiStatus(kpi.variance),
          timestamp: kpi.timestamp,
        })),
      }
    }

    return summary
  }

  @Cron(CronExpression.EVERY_HOUR)
  async calculateAutomaticKpis(): Promise<void> {
    this.logger.log("Calculating automatic KPIs...")

    try {
      // Transaction volume KPI
      await this.calculateTransactionVolumeKpi()

      // User engagement KPI
      await this.calculateUserEngagementKpi()

      // Revenue KPI
      await this.calculateRevenueKpi()

      // Performance KPI
      await this.calculatePerformanceKpi()

      this.logger.log("Automatic KPIs calculated successfully")
    } catch (error) {
      this.logger.error("Failed to calculate automatic KPIs:", error)
    }
  }

  private async calculateTransactionVolumeKpi(): Promise<void> {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours

    const metrics = await this.analyticsService.getMetrics({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      filters: { name: "transaction_volume" },
    })

    const totalVolume = metrics.data.reduce((sum, m) => sum + Number(m.value), 0)

    await this.recordKpi({
      name: "daily_transaction_volume",
      value: totalVolume,
      target: 100000, // $100k target
      unit: "USD",
      category: "transactions",
      metadata: { period: "24h", count: metrics.total },
    })
  }

  private async calculateUserEngagementKpi(): Promise<void> {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours

    const metrics = await this.analyticsService.getMetrics({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      filters: { name: { $like: "user_engagement_%" } },
    })

    const uniqueUsers = new Set(metrics.data.map((m) => m.userId)).size
    const totalEngagements = metrics.total

    await this.recordKpi({
      name: "daily_active_users",
      value: uniqueUsers,
      target: 1000,
      unit: "users",
      category: "engagement",
      metadata: { totalEngagements, period: "24h" },
    })

    const avgEngagementsPerUser = uniqueUsers > 0 ? totalEngagements / uniqueUsers : 0

    await this.recordKpi({
      name: "avg_engagements_per_user",
      value: avgEngagementsPerUser,
      target: 5,
      unit: "engagements",
      category: "engagement",
      metadata: { period: "24h" },
    })
  }

  private async calculateRevenueKpi(): Promise<void> {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours

    const revenueMetrics = await this.analyticsService.getMetrics({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      filters: { name: "revenue_total" },
    })

    const totalRevenue = revenueMetrics.data.reduce((sum, m) => sum + Number(m.value), 0)

    await this.recordKpi({
      name: "daily_revenue",
      value: totalRevenue,
      target: 10000, // $10k target
      unit: "USD",
      category: "revenue",
      metadata: { period: "24h", transactions: revenueMetrics.total },
    })
  }

  private async calculatePerformanceKpi(): Promise<void> {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 60 * 60 * 1000) // Last hour

    const performanceMetrics = await this.analyticsService.getMetrics({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      filters: { name: "api_response_time" },
    })

    const avgResponseTime =
      performanceMetrics.data.reduce((sum, m) => sum + Number(m.value), 0) / performanceMetrics.total || 0

    await this.recordKpi({
      name: "avg_response_time",
      value: avgResponseTime,
      target: 200, // 200ms target
      unit: "ms",
      category: "performance",
      metadata: { period: "1h", requests: performanceMetrics.total },
    })
  }

  private getLatestKpisByName(kpis: KpiMetric[]): KpiMetric[] {
    const kpiMap = new Map<string, KpiMetric>()

    for (const kpi of kpis) {
      const existing = kpiMap.get(kpi.name)
      if (!existing || kpi.timestamp > existing.timestamp) {
        kpiMap.set(kpi.name, kpi)
      }
    }

    return Array.from(kpiMap.values())
  }

  private getKpiStatus(variance: number | null): "good" | "warning" | "critical" {
    if (variance === null) return "good"

    if (variance >= 0) return "good"
    if (variance >= -10) return "warning"
    return "critical"
  }
}
