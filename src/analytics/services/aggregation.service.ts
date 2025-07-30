import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Metric } from "../entities/metric.entity"
import type { AnalyticsQueryDto } from "../dto/analytics-query.dto"

@Injectable()
export class AggregationService {
  constructor(private metricRepository: Repository<Metric>) {}

  async getAggregations(query: AnalyticsQueryDto): Promise<Record<string, any>> {
    const queryBuilder = this.metricRepository.createQueryBuilder("metric")

    // Apply filters
    if (query.startDate) {
      queryBuilder.andWhere("metric.timestamp >= :startDate", { startDate: query.startDate })
    }
    if (query.endDate) {
      queryBuilder.andWhere("metric.timestamp <= :endDate", { endDate: query.endDate })
    }
    if (query.filters) {
      Object.entries(query.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryBuilder.andWhere(`metric.${key} = :${key}`, { [key]: value })
        }
      })
    }

    const aggregations: Record<string, any> = {}

    // Calculate requested aggregations
    if (query.metrics) {
      for (const metricType of query.metrics) {
        switch (metricType) {
          case "sum":
            const sumResult = await queryBuilder.select("SUM(metric.value)", "sum").getRawOne()
            aggregations.sum = Number(sumResult.sum) || 0
            break
          case "avg":
            const avgResult = await queryBuilder.select("AVG(metric.value)", "avg").getRawOne()
            aggregations.avg = Number(avgResult.avg) || 0
            break
          case "count":
            const countResult = await queryBuilder.select("COUNT(*)", "count").getRawOne()
            aggregations.count = Number(countResult.count) || 0
            break
          case "max":
            const maxResult = await queryBuilder.select("MAX(metric.value)", "max").getRawOne()
            aggregations.max = Number(maxResult.max) || 0
            break
          case "min":
            const minResult = await queryBuilder.select("MIN(metric.value)", "min").getRawOne()
            aggregations.min = Number(minResult.min) || 0
            break
        }
      }
    }

    return aggregations
  }

  async getMetricSummary(query: AnalyticsQueryDto): Promise<Record<string, any>> {
    const queryBuilder = this.metricRepository.createQueryBuilder("metric")

    // Apply filters
    if (query.startDate) {
      queryBuilder.andWhere("metric.timestamp >= :startDate", { startDate: query.startDate })
    }
    if (query.endDate) {
      queryBuilder.andWhere("metric.timestamp <= :endDate", { endDate: query.endDate })
    }

    // Get summary statistics
    const summary = await queryBuilder
      .select([
        "COUNT(*) as total_metrics",
        "COUNT(DISTINCT metric.name) as unique_metrics",
        "COUNT(DISTINCT metric.userId) as unique_users",
        "SUM(metric.value) as total_value",
        "AVG(metric.value) as average_value",
        "MAX(metric.value) as max_value",
        "MIN(metric.value) as min_value",
      ])
      .getRawOne()

    // Get metrics by type
    const metricsByType = await queryBuilder
      .select(["metric.type", "COUNT(*) as count"])
      .groupBy("metric.type")
      .getRawMany()

    // Get top metrics by name
    const topMetrics = await queryBuilder
      .select(["metric.name", "COUNT(*) as count", "SUM(metric.value) as total_value"])
      .groupBy("metric.name")
      .orderBy("count", "DESC")
      .limit(10)
      .getRawMany()

    return {
      summary: {
        totalMetrics: Number(summary.total_metrics) || 0,
        uniqueMetrics: Number(summary.unique_metrics) || 0,
        uniqueUsers: Number(summary.unique_users) || 0,
        totalValue: Number(summary.total_value) || 0,
        averageValue: Number(summary.average_value) || 0,
        maxValue: Number(summary.max_value) || 0,
        minValue: Number(summary.min_value) || 0,
      },
      metricsByType: metricsByType.map((item) => ({
        type: item.metric_type,
        count: Number(item.count),
      })),
      topMetrics: topMetrics.map((item) => ({
        name: item.metric_name,
        count: Number(item.count),
        totalValue: Number(item.total_value),
      })),
    }
  }

  async getTimeSeriesAggregation(
    metricName: string,
    interval: "hour" | "day" | "week" | "month",
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ timestamp: string; value: number; count: number }>> {
    const queryBuilder = this.metricRepository.createQueryBuilder("metric")

    let dateFormat: string
    switch (interval) {
      case "hour":
        dateFormat = "%Y-%m-%d %H:00:00"
        break
      case "day":
        dateFormat = "%Y-%m-%d"
        break
      case "week":
        dateFormat = "%Y-%u"
        break
      case "month":
        dateFormat = "%Y-%m"
        break
    }

    const results = await queryBuilder
      .select([
        `DATE_FORMAT(metric.timestamp, '${dateFormat}') as period`,
        "SUM(metric.value) as total_value",
        "COUNT(*) as count",
      ])
      .where("metric.name = :metricName", { metricName })
      .andWhere("metric.timestamp >= :startDate", { startDate })
      .andWhere("metric.timestamp <= :endDate", { endDate })
      .groupBy("period")
      .orderBy("period", "ASC")
      .getRawMany()

    return results.map((result) => ({
      timestamp: result.period,
      value: Number(result.total_value) || 0,
      count: Number(result.count) || 0,
    }))
  }
}
