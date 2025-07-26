import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Metric } from "../entities/metric.entity"

@Injectable()
export class TimeSeriesService {
  private readonly logger = new Logger(TimeSeriesService.name)

  constructor(private metricRepository: Repository<Metric>) {}

  async getTimeSeriesData(
    metricName: string,
    startDate: Date,
    endDate: Date,
    interval: "minute" | "hour" | "day" | "week" | "month" = "hour",
  ): Promise<Array<{ timestamp: Date; value: number; count: number }>> {
    const queryBuilder = this.metricRepository.createQueryBuilder("metric")

    let groupByFormat: string
    switch (interval) {
      case "minute":
        groupByFormat = "DATE_FORMAT(metric.timestamp, '%Y-%m-%d %H:%i:00')"
        break
      case "hour":
        groupByFormat = "DATE_FORMAT(metric.timestamp, '%Y-%m-%d %H:00:00')"
        break
      case "day":
        groupByFormat = "DATE_FORMAT(metric.timestamp, '%Y-%m-%d')"
        break
      case "week":
        groupByFormat = "DATE_FORMAT(metric.timestamp, '%Y-%u')"
        break
      case "month":
        groupByFormat = "DATE_FORMAT(metric.timestamp, '%Y-%m')"
        break
    }

    const results = await queryBuilder
      .select([
        `${groupByFormat} as period`,
        "SUM(metric.value) as total_value",
        "AVG(metric.value) as avg_value",
        "COUNT(*) as count",
        "MAX(metric.value) as max_value",
        "MIN(metric.value) as min_value",
      ])
      .where("metric.name = :metricName", { metricName })
      .andWhere("metric.timestamp >= :startDate", { startDate })
      .andWhere("metric.timestamp <= :endDate", { endDate })
      .groupBy("period")
      .orderBy("period", "ASC")
      .getRawMany()

    return results.map((result) => ({
      timestamp: new Date(result.period),
      value: Number(result.total_value) || 0,
      avgValue: Number(result.avg_value) || 0,
      count: Number(result.count) || 0,
      maxValue: Number(result.max_value) || 0,
      minValue: Number(result.min_value) || 0,
    }))
  }

  async getMultiMetricTimeSeries(
    metricNames: string[],
    startDate: Date,
    endDate: Date,
    interval: "minute" | "hour" | "day" | "week" | "month" = "hour",
  ): Promise<Record<string, Array<{ timestamp: Date; value: number; count: number }>>> {
    const results: Record<string, Array<{ timestamp: Date; value: number; count: number }>> = {}

    for (const metricName of metricNames) {
      results[metricName] = await this.getTimeSeriesData(metricName, startDate, endDate, interval)
    }

    return results
  }

  async getRealtimeMetrics(metricNames: string[], windowMinutes = 60): Promise<Record<string, any>> {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - windowMinutes * 60 * 1000)

    const results: Record<string, any> = {}

    for (const metricName of metricNames) {
      const timeSeries = await this.getTimeSeriesData(metricName, startDate, endDate, "minute")

      const currentValue = timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].value : 0
      const previousValue = timeSeries.length > 1 ? timeSeries[timeSeries.length - 2].value : 0
      const change = currentValue - previousValue
      const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0

      results[metricName] = {
        current: currentValue,
        previous: previousValue,
        change,
        changePercent,
        timeSeries,
      }
    }

    return results
  }

  async detectAnomalies(
    metricName: string,
    startDate: Date,
    endDate: Date,
    threshold = 2, // Standard deviations
  ): Promise<Array<{ timestamp: Date; value: number; isAnomaly: boolean; score: number }>> {
    const timeSeries = await this.getTimeSeriesData(metricName, startDate, endDate, "hour")

    if (timeSeries.length < 10) {
      return timeSeries.map((point) => ({ ...point, isAnomaly: false, score: 0 }))
    }

    // Calculate mean and standard deviation
    const values = timeSeries.map((point) => point.value)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)

    // Detect anomalies
    return timeSeries.map((point) => {
      const score = Math.abs(point.value - mean) / stdDev
      const isAnomaly = score > threshold

      return {
        ...point,
        isAnomaly,
        score,
      }
    })
  }
}
