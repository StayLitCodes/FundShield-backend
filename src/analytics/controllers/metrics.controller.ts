import { Controller, Get, Query } from "@nestjs/common"
import type { TimeSeriesService } from "../services/time-series.service"
import type { KpiService } from "../services/kpi.service"

@Controller("metrics")
export class MetricsController {
  constructor(
    private readonly timeSeriesService: TimeSeriesService,
    private readonly kpiService: KpiService,
  ) {}

  @Get("timeseries/:metricName")
  async getTimeSeriesData(
    metricName: string,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("interval") interval: "minute" | "hour" | "day" | "week" | "month" = "hour",
  ) {
    return this.timeSeriesService.getTimeSeriesData(metricName, new Date(startDate), new Date(endDate), interval)
  }

  @Get("timeseries/multi")
  async getMultiMetricTimeSeries(
    @Query("metrics") metrics: string,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("interval") interval: "minute" | "hour" | "day" | "week" | "month" = "hour",
  ) {
    const metricNames = metrics.split(",")
    return this.timeSeriesService.getMultiMetricTimeSeries(
      metricNames,
      new Date(startDate),
      new Date(endDate),
      interval,
    )
  }

  @Get("realtime")
  async getRealtimeMetrics(@Query("metrics") metrics: string, @Query("window") windowMinutes = 60) {
    const metricNames = metrics.split(",")
    return this.timeSeriesService.getRealtimeMetrics(metricNames, windowMinutes)
  }

  @Get("anomalies/:metricName")
  async detectAnomalies(
    metricName: string,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("threshold") threshold = 2,
  ) {
    return this.timeSeriesService.detectAnomalies(metricName, new Date(startDate), new Date(endDate), threshold)
  }

  @Get("kpis")
  async getKpis(
    @Query("category") category?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.kpiService.getKpis(
      category,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    )
  }

  @Get("kpis/summary")
  async getKpiSummary() {
    return this.kpiService.getKpiSummary()
  }
}
