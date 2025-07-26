import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import { getQueueToken } from "@nestjs/bull"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import { AnalyticsService } from "../services/analytics.service"
import { Metric } from "../entities/metric.entity"
import { MetricsCollectionService } from "../services/metrics-collection.service"
import { AggregationService } from "../services/aggregation.service"
import { RealTimeService } from "../services/real-time.service"
import type { CreateMetricDto } from "../dto/create-metric.dto"
import { MetricType } from "../enums/metric-type.enum"
import { jest } from "@jest/globals"

describe("AnalyticsService", () => {
  let service: AnalyticsService
  let metricRepository: Repository<Metric>
  let metricsQueue: Queue

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockQueue = {
    add: jest.fn(),
  }

  const mockMetricsCollectionService = {
    recordUserEngagement: jest.fn(),
  }

  const mockAggregationService = {
    getAggregations: jest.fn(),
    getMetricSummary: jest.fn(),
  }

  const mockRealTimeService = {
    broadcastMetricUpdate: jest.fn(),
    getCurrentMetrics: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(Metric),
          useValue: mockRepository,
        },
        {
          provide: getQueueToken("metrics-queue"),
          useValue: mockQueue,
        },
        {
          provide: MetricsCollectionService,
          useValue: mockMetricsCollectionService,
        },
        {
          provide: AggregationService,
          useValue: mockAggregationService,
        },
        {
          provide: RealTimeService,
          useValue: mockRealTimeService,
        },
      ],
    }).compile()

    service = module.get<AnalyticsService>(AnalyticsService)
    metricRepository = module.get<Repository<Metric>>(getRepositoryToken(Metric))
    metricsQueue = module.get<Queue>(getQueueToken("metrics-queue"))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("recordMetric", () => {
    it("should record a metric successfully", async () => {
      const createMetricDto: CreateMetricDto = {
        type: MetricType.COUNTER,
        name: "test_metric",
        value: 100,
        userId: "user-123",
      }

      const mockMetric = {
        id: "metric-123",
        ...createMetricDto,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRepository.create.mockReturnValue(mockMetric)
      mockRepository.save.mockResolvedValue(mockMetric)

      const result = await service.recordMetric(createMetricDto)

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createMetricDto,
        timestamp: expect.any(Date),
      })
      expect(mockRepository.save).toHaveBeenCalledWith(mockMetric)
      expect(mockQueue.add).toHaveBeenCalledWith("process-metric", {
        metricId: mockMetric.id,
        metric: mockMetric,
      })
      expect(mockRealTimeService.broadcastMetricUpdate).toHaveBeenCalledWith(mockMetric)
      expect(result).toEqual(mockMetric)
    })
  })

  describe("getMetrics", () => {
    it("should return metrics with aggregations", async () => {
      const query = {
        startDate: "2023-01-01",
        endDate: "2023-01-31",
        metrics: ["sum", "avg"],
      }

      const mockMetrics = [
        { id: "1", name: "test_metric", value: 100, timestamp: new Date() },
        { id: "2", name: "test_metric", value: 200, timestamp: new Date() },
      ]

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockMetrics, 2]),
      }

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)
      mockAggregationService.getAggregations.mockResolvedValue({ sum: 300, avg: 150 })

      const result = await service.getMetrics(query)

      expect(result).toEqual({
        data: mockMetrics,
        total: 2,
        aggregations: { sum: 300, avg: 150 },
      })
    })
  })
})
