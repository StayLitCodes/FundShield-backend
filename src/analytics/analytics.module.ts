import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { BullModule } from "@nestjs/bull"
import { ConfigModule } from "@nestjs/config"
import { ScheduleModule } from "@nestjs/schedule"

// Entities
import { Metric } from "./entities/metric.entity"
import { UserEngagement } from "./entities/user-engagement.entity"
import { TransactionMetric } from "./entities/transaction-metric.entity"
import { EscrowMetric } from "./entities/escrow-metric.entity"
import { DisputeMetric } from "./entities/dispute-metric.entity"
import { RevenueMetric } from "./entities/revenue-metric.entity"
import { PerformanceMetric } from "./entities/performance-metric.entity"
import { Report } from "./entities/report.entity"
import { Dashboard } from "./entities/dashboard.entity"
import { KpiMetric } from "./entities/kpi-metric.entity"

// Services
import { AnalyticsService } from "./services/analytics.service"
import { MetricsCollectionService } from "./services/metrics-collection.service"
import { ReportGenerationService } from "./services/report-generation.service"
import { DashboardService } from "./services/dashboard.service"
import { ExportService } from "./services/export.service"
import { AggregationService } from "./services/aggregation.service"
import { TimeSeriesService } from "./services/time-series.service"
import { KpiService } from "./services/kpi.service"
import { RealTimeService } from "./services/real-time.service"

// Controllers
import { AnalyticsController } from "./controllers/analytics.controller"
import { ReportsController } from "./controllers/reports.controller"
import { DashboardController } from "./controllers/dashboard.controller"
import { MetricsController } from "./controllers/metrics.controller"

// Interceptors
import { AnalyticsInterceptor } from "./interceptors/analytics.interceptor"
import { PerformanceInterceptor } from "./interceptors/performance.interceptor"
import { UserEngagementInterceptor } from "./interceptors/user-engagement.interceptor"

// Processors
import { MetricsProcessor } from "./processors/metrics.processor"
import { ReportProcessor } from "./processors/report.processor"
import { AggregationProcessor } from "./processors/aggregation.processor"

// Gateways
import { AnalyticsGateway } from "./gateways/analytics.gateway"

// Config
import { analyticsConfig } from "./config/analytics.config"

@Module({
  imports: [
    ConfigModule.forFeature(analyticsConfig),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      Metric,
      UserEngagement,
      TransactionMetric,
      EscrowMetric,
      DisputeMetric,
      RevenueMetric,
      PerformanceMetric,
      Report,
      Dashboard,
      KpiMetric,
    ]),
    BullModule.registerQueue({ name: "metrics-queue" }, { name: "reports-queue" }, { name: "aggregation-queue" }),
  ],
  controllers: [AnalyticsController, ReportsController, DashboardController, MetricsController],
  providers: [
    AnalyticsService,
    MetricsCollectionService,
    ReportGenerationService,
    DashboardService,
    ExportService,
    AggregationService,
    TimeSeriesService,
    KpiService,
    RealTimeService,
    AnalyticsInterceptor,
    PerformanceInterceptor,
    UserEngagementInterceptor,
    MetricsProcessor,
    ReportProcessor,
    AggregationProcessor,
    AnalyticsGateway,
  ],
  exports: [
    AnalyticsService,
    MetricsCollectionService,
    AnalyticsInterceptor,
    PerformanceInterceptor,
    UserEngagementInterceptor,
  ],
})
export class AnalyticsModule {}
