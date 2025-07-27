import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import { getQueueToken } from "@nestjs/bull"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import { ReportGenerationService } from "../services/report-generation.service"
import { Report } from "../entities/report.entity"
import { ExportService } from "../services/export.service"
import { AnalyticsService } from "../services/analytics.service"
import type { CreateReportDto } from "../dto/create-report.dto"
import { ReportType } from "../enums/report-type.enum"
import { ReportStatus } from "../enums/report-status.enum"
import { jest } from "@jest/globals"

describe("ReportGenerationService", () => {
  let service: ReportGenerationService
  let reportRepository: Repository<Report>
  let reportsQueue: Queue

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }

  const mockQueue = {
    add: jest.fn(),
  }

  const mockExportService = {
    exportReport: jest.fn(),
  }

  const mockAnalyticsService = {
    getMetrics: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportGenerationService,
        {
          provide: getRepositoryToken(Report),
          useValue: mockRepository,
        },
        {
          provide: getQueueToken("reports-queue"),
          useValue: mockQueue,
        },
        {
          provide: ExportService,
          useValue: mockExportService,
        },
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile()

    service = module.get<ReportGenerationService>(ReportGenerationService)
    reportRepository = module.get<Repository<Report>>(getRepositoryToken(Report))
    reportsQueue = module.get<Queue>(getQueueToken("reports-queue"))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("createReport", () => {
    it("should create and queue a report", async () => {
      const createReportDto: CreateReportDto = {
        name: "Test Report",
        type: ReportType.TRANSACTION_SUMMARY,
        parameters: { startDate: "2023-01-01", endDate: "2023-01-31" },
        createdBy: "user-123",
        format: "pdf",
      }

      const mockReport = {
        id: "report-123",
        ...createReportDto,
        status: ReportStatus.PENDING,
        scheduledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRepository.create.mockReturnValue(mockReport)
      mockRepository.save.mockResolvedValue(mockReport)

      const result = await service.createReport(createReportDto)

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createReportDto,
        scheduledAt: expect.any(Date),
      })
      expect(mockRepository.save).toHaveBeenCalledWith(mockReport)
      expect(mockQueue.add).toHaveBeenCalledWith("generate-report", { reportId: mockReport.id }, expect.any(Object))
      expect(result).toEqual(mockReport)
    })
  })

  describe("generateReport", () => {
    it("should generate a transaction summary report", async () => {
      const mockReport = {
        id: "report-123",
        name: "Transaction Summary",
        type: ReportType.TRANSACTION_SUMMARY,
        parameters: { startDate: "2023-01-01", endDate: "2023-01-31" },
        status: ReportStatus.PENDING,
        format: "pdf",
      }

      const mockMetrics = {
        data: [
          { value: 1000, timestamp: new Date() },
          { value: 2000, timestamp: new Date() },
        ],
        total: 2,
      }

      mockRepository.findOne.mockResolvedValue(mockReport)
      mockAnalyticsService.getMetrics.mockResolvedValue(mockMetrics)
      mockExportService.exportReport.mockResolvedValue("/path/to/report.pdf")
      mockRepository.save.mockResolvedValue({
        ...mockReport,
        status: ReportStatus.COMPLETED,
        data: expect.any(Object),
        filePath: "/path/to/report.pdf",
        completedAt: expect.any(Date),
      })

      const result = await service.generateReport("report-123")

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: "report-123" } })
      expect(mockAnalyticsService.getMetrics).toHaveBeenCalled()
      expect(mockExportService.exportReport).toHaveBeenCalled()
      expect(result.status).toBe(ReportStatus.COMPLETED)
    })
  })
})
