import { Controller, Post, Get, Param, Query, Res } from "@nestjs/common"
import type { Response } from "express"
import type { ReportGenerationService } from "../services/report-generation.service"
import type { ExportService } from "../services/export.service"
import type { CreateReportDto } from "../dto/create-report.dto"

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reportGenerationService: ReportGenerationService,
    private readonly exportService: ExportService,
  ) {}

  @Post()
  async createReport(createReportDto: CreateReportDto) {
    return this.reportGenerationService.createReport(createReportDto)
  }

  @Get()
  async getReports(@Query("page") page = 1, @Query("limit") limit = 20) {
    return this.reportGenerationService.getReports(page, limit)
  }

  @Get("user/:userId")
  async getUserReports(@Param("userId") userId: string, @Query("page") page = 1, @Query("limit") limit = 20) {
    return this.reportGenerationService.getUserReports(userId, page, limit)
  }

  @Get(":id")
  async getReportById(@Param("id") id: string) {
    return this.reportGenerationService.getReportById(id)
  }

  @Get(":id/download")
  async downloadReport(@Param("id") id: string, @Res() res: Response) {
    const report = await this.reportGenerationService.getReportById(id)

    if (!report.filePath) {
      return res.status(404).json({ message: "Report file not found" })
    }

    try {
      const fileBuffer = await this.exportService.getExportFile(report.filePath)
      const filename = report.filePath.split("/").pop()

      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
      res.setHeader("Content-Type", "application/octet-stream")
      res.send(fileBuffer)
    } catch (error) {
      return res.status(404).json({ message: "File not found" })
    }
  }

  @Post(":id/regenerate")
  async regenerateReport(@Param("id") id: string) {
    return this.reportGenerationService.generateReport(id)
  }
}
