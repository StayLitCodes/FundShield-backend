import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { UserEngagement } from "../entities/user-engagement.entity"
import type { TransactionMetric } from "../entities/transaction-metric.entity"
import type { EscrowMetric } from "../entities/escrow-metric.entity"
import type { DisputeMetric } from "../entities/dispute-metric.entity"
import type { RevenueMetric } from "../entities/revenue-metric.entity"
import type { PerformanceMetric } from "../entities/performance-metric.entity"
import type { CreateUserEngagementDto } from "../dto/create-user-engagement.dto"
import type { AnalyticsService } from "./analytics.service"
import { MetricType } from "../enums/metric-type.enum"

@Injectable()
export class MetricsCollectionService {
  private readonly logger = new Logger(MetricsCollectionService.name)

  constructor(
    private userEngagementRepository: Repository<UserEngagement>,
    private transactionMetricRepository: Repository<TransactionMetric>,
    private escrowMetricRepository: Repository<EscrowMetric>,
    private disputeMetricRepository: Repository<DisputeMetric>,
    private revenueMetricRepository: Repository<RevenueMetric>,
    private performanceMetricRepository: Repository<PerformanceMetric>,
    private analyticsService: AnalyticsService,
  ) {}

  async recordUserEngagement(engagementDto: CreateUserEngagementDto): Promise<UserEngagement> {
    const engagement = this.userEngagementRepository.create({
      ...engagementDto,
      timestamp: engagementDto.timestamp ? new Date(engagementDto.timestamp) : new Date(),
    })

    const savedEngagement = await this.userEngagementRepository.save(engagement)

    // Record as general metric
    await this.analyticsService.recordMetric({
      type: MetricType.COUNTER,
      name: `user_engagement_${engagement.type}`,
      value: 1,
      entityId: engagement.userId,
      entityType: "user",
      userId: engagement.userId,
      metadata: {
        action: engagement.action,
        page: engagement.page,
        feature: engagement.feature,
      },
    })

    return savedEngagement
  }

  async recordTransactionMetric(data: {
    transactionId: string
    userId: string
    amount: number
    currency?: string
    status: string
    type: string
    fee?: number
    processingTime?: number
    metadata?: Record<string, any>
  }): Promise<TransactionMetric> {
    const metric = this.transactionMetricRepository.create({
      ...data,
      timestamp: new Date(),
    })

    const savedMetric = await this.transactionMetricRepository.save(metric)

    // Record volume metric
    await this.analyticsService.recordMetric({
      type: MetricType.GAUGE,
      name: "transaction_volume",
      value: data.amount,
      entityId: data.transactionId,
      entityType: "transaction",
      userId: data.userId,
      metadata: { currency: data.currency, type: data.type },
    })

    // Record count metric
    await this.analyticsService.recordMetric({
      type: MetricType.COUNTER,
      name: `transaction_${data.status}`,
      value: 1,
      entityId: data.transactionId,
      entityType: "transaction",
      userId: data.userId,
    })

    return savedMetric
  }

  async recordEscrowMetric(data: {
    escrowId: string
    buyerId: string
    sellerId: string
    amount: number
    currency?: string
    status: string
    completionTime?: number
    metadata?: Record<string, any>
  }): Promise<EscrowMetric> {
    const metric = this.escrowMetricRepository.create({
      ...data,
      timestamp: new Date(),
    })

    const savedMetric = await this.escrowMetricRepository.save(metric)

    // Calculate success rate
    const successRate = await this.calculateEscrowSuccessRate()
    savedMetric.successRate = successRate

    await this.escrowMetricRepository.save(savedMetric)

    // Record escrow metrics
    await this.analyticsService.recordMetric({
      type: MetricType.GAUGE,
      name: "escrow_success_rate",
      value: successRate,
      metadata: { escrowId: data.escrowId },
    })

    return savedMetric
  }

  async recordDisputeMetric(data: {
    disputeId: string
    escrowId: string
    initiatorId: string
    status: string
    category: string
    resolutionTime?: number
    resolution?: string
    metadata?: Record<string, any>
  }): Promise<DisputeMetric> {
    const metric = this.disputeMetricRepository.create({
      ...data,
      timestamp: new Date(),
    })

    const savedMetric = await this.disputeMetricRepository.save(metric)

    // Calculate resolution rate
    const resolutionRate = await this.calculateDisputeResolutionRate()
    savedMetric.resolutionRate = resolutionRate

    await this.disputeMetricRepository.save(savedMetric)

    // Record dispute metrics
    await this.analyticsService.recordMetric({
      type: MetricType.GAUGE,
      name: "dispute_resolution_rate",
      value: resolutionRate,
      metadata: { category: data.category },
    })

    return savedMetric
  }

  async recordRevenueMetric(data: {
    amount: number
    currency?: string
    revenueType: string
    sourceId?: string
    sourceType?: string
    fee?: number
    metadata?: Record<string, any>
  }): Promise<RevenueMetric> {
    const netRevenue = data.amount - (data.fee || 0)

    const metric = this.revenueMetricRepository.create({
      ...data,
      netRevenue,
      timestamp: new Date(),
    })

    const savedMetric = await this.revenueMetricRepository.save(metric)

    // Record revenue metrics
    await this.analyticsService.recordMetric({
      type: MetricType.GAUGE,
      name: "revenue_total",
      value: data.amount,
      metadata: { revenueType: data.revenueType, currency: data.currency },
    })

    await this.analyticsService.recordMetric({
      type: MetricType.GAUGE,
      name: "revenue_net",
      value: netRevenue,
      metadata: { revenueType: data.revenueType, currency: data.currency },
    })

    return savedMetric
  }

  async recordPerformanceMetric(data: {
    endpoint: string
    method: string
    responseTime: number
    statusCode: number
    memoryUsage?: number
    cpuUsage?: number
    userId?: string
    userAgent?: string
    metadata?: Record<string, any>
  }): Promise<PerformanceMetric> {
    const metric = this.performanceMetricRepository.create({
      ...data,
      timestamp: new Date(),
    })

    const savedMetric = await this.performanceMetricRepository.save(metric)

    // Record performance metrics
    await this.analyticsService.recordMetric({
      type: MetricType.HISTOGRAM,
      name: "api_response_time",
      value: data.responseTime,
      metadata: { endpoint: data.endpoint, method: data.method },
    })

    return savedMetric
  }

  private async calculateEscrowSuccessRate(): Promise<number> {
    const total = await this.escrowMetricRepository.count()
    const successful = await this.escrowMetricRepository.count({
      where: { status: "released" as any },
    })

    return total > 0 ? (successful / total) * 100 : 0
  }

  private async calculateDisputeResolutionRate(): Promise<number> {
    const total = await this.disputeMetricRepository.count()
    const resolved = await this.disputeMetricRepository.count({
      where: { status: "resolved" as any },
    })

    return total > 0 ? (resolved / total) * 100 : 0
  }
}
