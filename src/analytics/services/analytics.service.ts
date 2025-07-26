import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import type { Metric } from "../entities/metric.entity"
import type { CreateMetricDto } from "../dto/create-metric.dto"
import type { BulkMetricsDto } from "../dto/bulk-metrics.dto"
import type { AnalyticsQueryDto } from "../dto/analytics-query.dto"
import type { MetricsCollectionService } from "./metrics-collection.service"
import type { AggregationService } from "./aggregation.service"
import type { RealTimeService } from "./real-time.service"

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name)

  constructor(
    private metricRepository: Repository<Metric>,
    private metricsQueue: Queue,
    private metricsCollectionService: MetricsCollectionService,
    private aggregationService: AggregationService,
    private realTimeService: RealTimeService,
  ) {}

  async recordMetric(createMetricDto: CreateMetricDto): Promise<Metric> {
    const metric = this.metricRepository.create({
      ...createMetricDto,
      timestamp: createMetricDto.timestamp ? new Date(createMetricDto.timestamp) : new Date(),
    })

    const savedMetric = await this.metricRepository.save(metric)

    // Queue for real-time processing
    await this.metricsQueue.add("process-metric", {
      metricId: savedMetric.id,
      metric: savedMetric,
    })

    // Send real-time update
    await this.realTimeService.broadcastMetricUpdate(savedMetric)

    this.logger.log(`Metric recorded: ${savedMetric.name} = ${savedMetric.value}`)
    return savedMetric
  }

  async recordBulkMetrics(bulkMetricsDto: BulkMetricsDto): Promise<Metric[]> {
    const metrics = bulkMetricsDto.metrics.map((metricDto) =>
      this.metricRepository.create({
        ...metricDto,
        timestamp: metricDto.timestamp ? new Date(metricDto.timestamp) : new Date(),
      }),
    )

    const savedMetrics = await this.metricRepository.save(metrics)

    // Queue for bulk processing
    await this.metricsQueue.add("process-bulk-metrics", {
      metrics: savedMetrics,
    })

    this.logger.log(`Bulk metrics recorded: ${savedMetrics.length} metrics`)
    return savedMetrics
  }

  async getMetrics(query: AnalyticsQueryDto): Promise<{
    data: Metric[]
    total: number
    aggregations?: Record<string, any>
  }> {
    const queryBuilder = this.metricRepository.createQueryBuilder("metric")

    // Apply date filters
    if (query.startDate) {
      queryBuilder.andWhere("metric.timestamp >= :startDate", { startDate: query.startDate })
    }
    if (query.endDate) {
      queryBuilder.andWhere("metric.timestamp <= :endDate", { endDate: query.endDate })
    }

    // Apply filters
    if (query.filters) {
      Object.entries(query.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryBuilder.andWhere(`metric.${key} = :${key}`, { [key]: value })
        }
      })
    }

    // Apply sorting
    if (query.sortBy) {
      queryBuilder.orderBy(`metric.${query.sortBy}`, query.sortOrder || "DESC")
    } else {
      queryBuilder.orderBy("metric.timestamp", "DESC")
    }

    // Apply pagination
    if (query.limit) {
      queryBuilder.limit(query.limit)
    }
    if (query.offset) {
      queryBuilder.offset(query.offset)
    }

    const [data, total] = await queryBuilder.getManyAndCount()

    // Get aggregations if requested
    let aggregations: Record<string, any> | undefined
    if (query.metrics && query.metrics.length > 0) {
      aggregations = await this.aggregationService.getAggregations(query)
    }

    return { data, total, aggregations }
  }

  async getMetricsByType(type: string, query: AnalyticsQueryDto): Promise<Metric[]> {
    const queryBuilder = this.metricRepository.createQueryBuilder("metric").where("metric.type = :type", { type })

    if (query.startDate) {
      queryBuilder.andWhere("metric.timestamp >= :startDate", { startDate: query.startDate })
    }
    if (query.endDate) {
      queryBuilder.andWhere("metric.timestamp <= :endDate", { endDate: query.endDate })
    }

    queryBuilder.orderBy("metric.timestamp", "DESC")

    if (query.limit) {
      queryBuilder.limit(query.limit)
    }

    return queryBuilder.getMany()
  }

  async getMetricSummary(query: AnalyticsQueryDto): Promise<Record<string, any>> {
    const summary = await this.aggregationService.getMetricSummary(query)
    return summary
  }

  async getRealtimeMetrics(): Promise<Record<string, any>> {
    return this.realTimeService.getCurrentMetrics()
  }

  async deleteOldMetrics(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const result = await this.metricRepository
      .createQueryBuilder()
      .delete()
      .where("timestamp < :cutoffDate", { cutoffDate })
      .execute()

    this.logger.log(`Deleted ${result.affected} old metrics`)
    return result.affected || 0
  }
}
