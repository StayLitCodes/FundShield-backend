import { Process, Processor } from "@nestjs/bull"
import type { Job } from "bull"
import { Logger } from "@nestjs/common"
import type { ReportGenerationService } from "../services/report-generation.service"

@Processor("reports-queue")
export class ReportProcessor {
  private readonly logger = new Logger(ReportProcessor.name)

  constructor(private reportGenerationService: ReportGenerationService) {}

  @Process("generate-report")
  async handleGenerateReport(job: Job) {
    const { reportId } = job.data

    try {
      this.logger.log(`Generating report: ${reportId}`)

      await this.reportGenerationService.generateReport(reportId)

      this.logger.log(`Report generated successfully: ${reportId}`)
    } catch (error) {
      this.logger.error(`Failed to generate report ${reportId}:`, error)
      throw error
    }
  }
}
