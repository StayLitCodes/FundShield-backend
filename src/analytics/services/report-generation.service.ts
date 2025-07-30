import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import type { Report } from "../entities/report.entity"
import type { CreateReportDto } from "../dto/create-report.dto"
import { ReportStatus } from "../enums/report-status.enum"
import { ReportType } from "../enums/report-type.enum"
import type { ExportService } from "./export.service"
import type { AnalyticsService } from "./analytics.service"

@Injectable()
export class ReportGenerationService {
  private readonly logger = new Logger(ReportGenerationService.name)

  constructor(
    private reportRepository: Repository<Report>,
    private reportsQueue: Queue,
    private exportService: ExportService,
    private analyticsService: AnalyticsService,
  ) {}

  async createReport(createReportDto: CreateReportDto): Promise<Report> {
    const report = this.reportRepository.create({
      ...createReportDto,
      scheduledAt: createReportDto.scheduledAt ? new Date(createReportDto.scheduledAt) : new Date(),
    })

    const savedReport = await this.reportRepository.save(report)

    // Queue report generation
    const delay = createReportDto.scheduledAt ? new Date(createReportDto.scheduledAt).getTime() - Date.now() : 0

    await this.reportsQueue.add(
      "generate-report",
      {
        reportId: savedReport.id,
      },
      {
        delay: Math.max(0, delay),
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    )

    this.logger.log(`Report queued for generation: ${savedReport.name}`)
    return savedReport
  }

  async generateReport(reportId: string): Promise<Report> {
    const report = await this.getReportById(reportId)

    try {
      await this.updateReportStatus(reportId, ReportStatus.PROCESSING)

      let data: any
      switch (report.type) {
        case ReportType.TRANSACTION_SUMMARY:
          data = await this.generateTransactionSummaryReport(report.parameters)
          break
        case ReportType.USER_ENGAGEMENT:
          data = await this.generateUserEngagementReport(report.parameters)
          break
        case ReportType.REVENUE_ANALYSIS:
          data = await this.generateRevenueAnalysisReport(report.parameters)
          break
        case ReportType.ESCROW_PERFORMANCE:
          data = await this.generateEscrowPerformanceReport(report.parameters)
          break
        case ReportType.DISPUTE_ANALYSIS:
          data = await this.generateDisputeAnalysisReport(report.parameters)
          break
        case ReportType.PERFORMANCE_METRICS:
          data = await this.generatePerformanceMetricsReport(report.parameters)
          break
        default:
          throw new Error(`Unsupported report type: ${report.type}`)
      }

      // Export report if format is specified
      let filePath: string | undefined
      if (report.format) {
        filePath = await this.exportService.exportReport(data, report.format, report.name)
      }

      // Update report with data and completion status
      const updatedReport = await this.reportRepository.save({
        ...report,
        data,
        filePath,
        status: ReportStatus.COMPLETED,
        completedAt: new Date(),
      })

      this.logger.log(`Report generated successfully: ${report.name}`)
      return updatedReport
    } catch (error) {
      this.logger.error(`Failed to generate report ${reportId}:`, error)

      await this.reportRepository.save({
        ...report,
        status: ReportStatus.FAILED,
        errorMessage: error.message,
      })

      throw error
    }
  }

  async getReportById(id: string): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id } })
    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`)
    }
    return report
  }

  async getReports(page = 1, limit = 20): Promise<{ data: Report[]; total: number }> {
    const [data, total] = await this.reportRepository.findAndCount({
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    })

    return { data, total }
  }

  async getUserReports(userId: string, page = 1, limit = 20): Promise<{ data: Report[]; total: number }> {
    const [data, total] = await this.reportRepository.findAndCount({
      where: { createdBy: userId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    })

    return { data, total }
  }

  async deleteReport(id: string): Promise<void> {
    const result = await this.reportRepository.delete(id)
    if (result.affected === 0) {
      throw new NotFoundException(`Report with ID ${id} not found`)
    }
  }

  private async updateReportStatus(reportId: string, status: ReportStatus): Promise<void> {
    await this.reportRepository.update(reportId, { status })
  }

  private async generateTransactionSummaryReport(parameters: Record<string, any>): Promise<any> {
    const { startDate, endDate, groupBy = "day" } = parameters

    const metrics = await this.analyticsService.getMetrics({
      startDate,
      endDate,
      filters: { name: "transaction_volume" },
      groupBy,
    })

    return {
      summary: {
        totalTransactions: metrics.total,
        totalVolume: metrics.data.reduce((sum, m) => sum + Number(m.value), 0),
        averageTransactionSize:
          metrics.total > 0 ? metrics.data.reduce((sum, m) => sum + Number(m.value), 0) / metrics.total : 0,
      },
      timeSeries: metrics.data,
      period: { startDate, endDate },
    }
  }

  private async generateUserEngagementReport(parameters: Record<string, any>): Promise<any> {
    const { startDate, endDate } = parameters

    const engagementMetrics = await this.analyticsService.getMetrics({
      startDate,
      endDate,
      filters: { name: { $like: "user_engagement_%" } },
    })

    return {
      summary: {
        totalEngagements: engagementMetrics.total,
        uniqueUsers: new Set(engagementMetrics.data.map((m) => m.userId)).size,
      },
      engagementTypes: engagementMetrics.data.reduce((acc, metric) => {
        const type = metric.name.replace("user_engagement_", "")
        acc[type] = (acc[type] || 0) + Number(metric.value)
        return acc
      }, {}),
      period: { startDate, endDate },
    }
  }

  private async generateRevenueAnalysisReport(parameters: Record<string, any>): Promise<any> {
    const { startDate, endDate } = parameters

    const revenueMetrics = await this.analyticsService.getMetrics({
      startDate,
      endDate,
      filters: { name: "revenue_total" },
    })

    const netRevenueMetrics = await this.analyticsService.getMetrics({
      startDate,
      endDate,
      filters: { name: "revenue_net" },
    })

    return {
      summary: {
        totalRevenue: revenueMetrics.data.reduce((sum, m) => sum + Number(m.value), 0),
        netRevenue: netRevenueMetrics.data.reduce((sum, m) => sum + Number(m.value), 0),
        transactionCount: revenueMetrics.total,
      },
      timeSeries: revenueMetrics.data,
      period: { startDate, endDate },
    }
  }

  private async generateEscrowPerformanceReport(parameters: Record<string, any>): Promise<any> {
    const { startDate, endDate } = parameters

    const successRateMetrics = await this.analyticsService.getMetrics({
      startDate,
      endDate,
      filters: { name: "escrow_success_rate" },
    })

    return {
      summary: {
        averageSuccessRate:
          successRateMetrics.data.reduce((sum, m) => sum + Number(m.value), 0) / successRateMetrics.total || 0,
        totalEscrows: successRateMetrics.total,
      },
      timeSeries: successRateMetrics.data,
      period: { startDate, endDate },
    }
  }

  private async generateDisputeAnalysisReport(parameters: Record<string, any>): Promise<any> {
    const { startDate, endDate } = parameters

    const resolutionRateMetrics = await this.analyticsService.getMetrics({
      startDate,
      endDate,
      filters: { name: "dispute_resolution_rate" },
    })

    return {
      summary: {
        averageResolutionRate:
          resolutionRateMetrics.data.reduce((sum, m) => sum + Number(m.value), 0) / resolutionRateMetrics.total || 0,
        totalDisputes: resolutionRateMetrics.total,
      },
      timeSeries: resolutionRateMetrics.data,
      period: { startDate, endDate },
    }
  }

  private async generatePerformanceMetricsReport(parameters: Record<string, any>): Promise<any> {
    const { startDate, endDate } = parameters

    const responseTimeMetrics = await this.analyticsService.getMetrics({
      startDate,
      endDate,
      filters: { name: "api_response_time" },
    })

    return {
      summary: {
        averageResponseTime:
          responseTimeMetrics.data.reduce((sum, m) => sum + Number(m.value), 0) / responseTimeMetrics.total || 0,
        totalRequests: responseTimeMetrics.total,
      },
      timeSeries: responseTimeMetrics.data,
      period: { startDate, endDate },
    }
  }
}
