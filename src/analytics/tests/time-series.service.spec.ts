import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { TimeSeriesService } from "../services/time-series.service"
import { Metric } from "../entities/metric.entity"
import { jest } from "@jest/globals"

describe("TimeSeriesService", () => {
  let service: TimeSeriesService
  let metricRepository: Repository<Metric>

  const mockRepository = {
    createQueryBuilder: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeSeriesService,
        {
          provide: getRepositoryToken(Metric),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<TimeSeriesService>(TimeSeriesService)
    metricRepository = module.get<Repository<Metric>>(getRepositoryToken(Metric))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("getTimeSeriesData", () => {
    it("should return time series data", async () => {
      const mockResults = [
        {
          period: "2023-01-01 10:00:00",
          total_value: 1000,
          avg_value: 500,
          count: 2,
          max_value: 800,
          min_value: 200,
        },
        {
          period: "2023-01-01 11:00:00",
          total_value: 1500,
          avg_value: 750,
          count: 2,
          max_value: 1000,
          min_value: 500,
        },
      ]

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockResults),
      }

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

      const result = await service.getTimeSeriesData(
        "test_metric",
        new Date("2023-01-01"),
        new Date("2023-01-02"),
        "hour",
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        timestamp: new Date("2023-01-01 10:00:00"),
        value: 1000,
        avgValue: 500,
        count: 2,
        maxValue: 800,
        minValue: 200,
      })
    })

    it("should detect anomalies in time series data", async () => {
      const mockTimeSeries = [
        { timestamp: new Date(), value: 100, count: 1 },
        { timestamp: new Date(), value: 110, count: 1 },
        { timestamp: new Date(), value: 105, count: 1 },
        { timestamp: new Date(), value: 500, count: 1 }, // Anomaly
        { timestamp: new Date(), value: 95, count: 1 },
      ]

      jest.spyOn(service, "getTimeSeriesData").mockResolvedValue(mockTimeSeries)

      const result = await service.detectAnomalies("test_metric", new Date("2023-01-01"), new Date("2023-01-02"), 2)

      expect(result).toHaveLength(5)
      expect(result[3].isAnomaly).toBe(true) // The 500 value should be detected as anomaly
      expect(result[0].isAnomaly).toBe(false)
    })
  })
})
