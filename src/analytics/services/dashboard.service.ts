import { Injectable, NotFoundException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Dashboard } from "../entities/dashboard.entity"
import type { CreateDashboardDto, UpdateDashboardDto } from "../dto/dashboard.dto"
import type { AnalyticsService } from "./analytics.service"

@Injectable()
export class DashboardService {
  constructor(
    private dashboardRepository: Repository<Dashboard>,
    private analyticsService: AnalyticsService,
  ) {}

  async createDashboard(createDashboardDto: CreateDashboardDto): Promise<Dashboard> {
    const dashboard = this.dashboardRepository.create(createDashboardDto)
    return this.dashboardRepository.save(dashboard)
  }

  async updateDashboard(id: string, updateDashboardDto: UpdateDashboardDto): Promise<Dashboard> {
    const dashboard = await this.getDashboardById(id)
    Object.assign(dashboard, updateDashboardDto)
    return this.dashboardRepository.save(dashboard)
  }

  async getDashboardById(id: string): Promise<Dashboard> {
    const dashboard = await this.dashboardRepository.findOne({ where: { id } })
    if (!dashboard) {
      throw new NotFoundException(`Dashboard with ID ${id} not found`)
    }
    return dashboard
  }

  async getDashboards(userId?: string): Promise<Dashboard[]> {
    const queryBuilder = this.dashboardRepository.createQueryBuilder("dashboard")

    if (userId) {
      queryBuilder.where("dashboard.createdBy = :userId OR dashboard.isPublic = true", { userId })
    } else {
      queryBuilder.where("dashboard.isPublic = true")
    }

    queryBuilder.andWhere("dashboard.isActive = true").orderBy("dashboard.createdAt", "DESC")

    return queryBuilder.getMany()
  }

  async getUserDashboards(userId: string): Promise<Dashboard[]> {
    return this.dashboardRepository.find({
      where: { createdBy: userId, isActive: true },
      order: { createdAt: "DESC" },
    })
  }

  async getDashboardData(
    id: string,
    filters?: Record<string, any>,
  ): Promise<{
    dashboard: Dashboard
    data: Record<string, any>
  }> {
    const dashboard = await this.getDashboardById(id)
    const data: Record<string, any> = {}

    // Process each widget
    for (const widget of dashboard.widgets) {
      try {
        const widgetData = await this.getWidgetData(widget, filters)
        data[widget.id] = widgetData
      } catch (error) {
        data[widget.id] = { error: error.message }
      }
    }

    return { dashboard, data }
  }

  async deleteDashboard(id: string): Promise<void> {
    const result = await this.dashboardRepository.delete(id)
    if (result.affected === 0) {
      throw new NotFoundException(`Dashboard with ID ${id} not found`)
    }
  }

  private async getWidgetData(widget: any, filters?: Record<string, any>): Promise<any> {
    const { type, config } = widget
    const mergedFilters = { ...config.filters, ...filters }

    switch (type) {
      case "metric":
        return this.getMetricWidgetData(config, mergedFilters)
      case "chart":
        return this.getChartWidgetData(config, mergedFilters)
      case "table":
        return this.getTableWidgetData(config, mergedFilters)
      case "kpi":
        return this.getKpiWidgetData(config, mergedFilters)
      default:
        throw new Error(`Unsupported widget type: ${type}`)
    }
  }

  private async getMetricWidgetData(config: any, filters: Record<string, any>): Promise<any> {
    const { metricName, aggregation = "sum" } = config

    const metrics = await this.analyticsService.getMetrics({
      filters: { name: metricName, ...filters },
      limit: 1000,
    })

    let value: number
    switch (aggregation) {
      case "sum":
        value = metrics.data.reduce((sum, m) => sum + Number(m.value), 0)
        break
      case "avg":
        value = metrics.data.reduce((sum, m) => sum + Number(m.value), 0) / metrics.data.length || 0
        break
      case "count":
        value = metrics.data.length
        break
      case "max":
        value = Math.max(...metrics.data.map((m) => Number(m.value)))
        break
      case "min":
        value = Math.min(...metrics.data.map((m) => Number(m.value)))
        break
      default:
        value = metrics.data.reduce((sum, m) => sum + Number(m.value), 0)
    }

    return { value, total: metrics.total }
  }

  private async getChartWidgetData(config: any, filters: Record<string, any>): Promise<any> {
    const { metricName, groupBy, chartType } = config

    const metrics = await this.analyticsService.getMetrics({
      filters: { name: metricName, ...filters },
      groupBy,
      limit: 1000,
    })

    return {
      data: metrics.data,
      chartType,
      total: metrics.total,
    }
  }

  private async getTableWidgetData(config: any, filters: Record<string, any>): Promise<any> {
    const { columns, limit = 10 } = config

    const metrics = await this.analyticsService.getMetrics({
      filters,
      limit,
    })

    return {
      columns,
      data: metrics.data,
      total: metrics.total,
    }
  }

  private async getKpiWidgetData(config: any, filters: Record<string, any>): Promise<any> {
    const { metricName, target, unit } = config

    const metrics = await this.analyticsService.getMetrics({
      filters: { name: metricName, ...filters },
      limit: 1,
      sortBy: "timestamp",
      sortOrder: "DESC",
    })

    const currentValue = metrics.data.length > 0 ? Number(metrics.data[0].value) : 0
    const variance = target ? ((currentValue - target) / target) * 100 : 0

    return {
      value: currentValue,
      target,
      variance,
      unit,
      status: variance >= 0 ? "positive" : "negative",
    }
  }
}
