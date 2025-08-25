import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { NotFoundException, BadRequestException } from "@nestjs/common"
import { DevelopersService } from "./developers.service"
import { Integration, IntegrationType, IntegrationStatus } from "./entities/integration.entity"
import { ApiIntegrationService } from "./services/api-integration.service"
import type { CreateIntegrationDto } from "./dto/create-integration.dto"
import { jest } from "@jest/globals" // Import jest to declare it

describe("DevelopersService", () => {
  let service: DevelopersService
  let repository: Repository<Integration>
  let apiIntegrationService: ApiIntegrationService

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  }

  const mockApiIntegrationService = {
    testConnection: jest.fn(),
  }

  const mockIntegration: Integration = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    developerId: "dev-123",
    type: IntegrationType.PRICE_FEED,
    name: "Test Price Feed",
    provider: "coinbase",
    config: { symbols: ["BTC", "ETH"] },
    credentials: { apiKey: "test-key" },
    status: IntegrationStatus.ACTIVE,
    apiEndpoint: "https://api.coinbase.com",
    rateLimit: 100,
    lastUsed: new Date(),
    errorCount: 0,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevelopersService,
        {
          provide: getRepositoryToken(Integration),
          useValue: mockRepository,
        },
        {
          provide: ApiIntegrationService,
          useValue: mockApiIntegrationService,
        },
      ],
    }).compile()

    service = module.get<DevelopersService>(DevelopersService)
    repository = module.get<Repository<Integration>>(getRepositoryToken(Integration))
    apiIntegrationService = module.get<ApiIntegrationService>(ApiIntegrationService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("create", () => {
    const createDto: CreateIntegrationDto = {
      developerId: "dev-123",
      type: IntegrationType.PRICE_FEED,
      name: "Test Price Feed",
      provider: "coinbase",
      config: { symbols: ["BTC", "ETH"] },
      credentials: { apiKey: "test-key" },
      apiEndpoint: "https://api.coinbase.com",
      rateLimit: 100,
    }

    it("should create an integration successfully", async () => {
      mockRepository.create.mockReturnValue(mockIntegration)
      mockRepository.save.mockResolvedValueOnce(mockIntegration)
      mockApiIntegrationService.testConnection.mockResolvedValue({ status: "connected" })
      mockRepository.save.mockResolvedValueOnce({
        ...mockIntegration,
        status: IntegrationStatus.ACTIVE,
      })

      const result = await service.create(createDto)

      expect(mockRepository.create).toHaveBeenCalledWith(createDto)
      expect(mockRepository.save).toHaveBeenCalledTimes(2)
      expect(apiIntegrationService.testConnection).toHaveBeenCalled()
      expect(result.status).toBe(IntegrationStatus.ACTIVE)
    })

    it("should set status to ERROR if test connection fails", async () => {
      const errorIntegration = { ...mockIntegration, status: IntegrationStatus.ERROR }
      mockRepository.create.mockReturnValue(mockIntegration)
      mockRepository.save.mockResolvedValueOnce(mockIntegration)
      mockApiIntegrationService.testConnection.mockRejectedValue(new Error("Connection failed"))
      mockRepository.save.mockResolvedValueOnce(errorIntegration)

      const result = await service.create(createDto)

      expect(result.status).toBe(IntegrationStatus.ERROR)
      expect(result.lastError).toBe("Connection failed")
    })

    it("should throw BadRequestException for invalid config", async () => {
      const invalidDto = { ...createDto, config: {} }

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException)
    })
  })

  describe("findOne", () => {
    it("should return an integration if found", async () => {
      mockRepository.findOne.mockResolvedValue(mockIntegration)

      const result = await service.findOne("123e4567-e89b-12d3-a456-426614174000")

      expect(result).toEqual(mockIntegration)
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: "123e4567-e89b-12d3-a456-426614174000" },
      })
    })

    it("should throw NotFoundException if integration not found", async () => {
      mockRepository.findOne.mockResolvedValue(null)

      await expect(service.findOne("non-existent-id")).rejects.toThrow(NotFoundException)
    })
  })

  describe("testIntegration", () => {
    it("should test integration successfully and update timestamps", async () => {
      mockRepository.findOne.mockResolvedValue(mockIntegration)
      mockApiIntegrationService.testConnection.mockResolvedValue({ status: "connected" })
      mockRepository.save.mockResolvedValue(mockIntegration)

      const result = await service.testIntegration("123e4567-e89b-12d3-a456-426614174000")

      expect(result).toEqual({ status: "connected" })
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastUsed: expect.any(Date),
          errorCount: 0,
          lastError: null,
        }),
      )
    })

    it("should handle test failure and update error information", async () => {
      mockRepository.findOne.mockResolvedValue(mockIntegration)
      mockApiIntegrationService.testConnection.mockRejectedValue(new Error("Test failed"))
      mockRepository.save.mockResolvedValue(mockIntegration)

      await expect(service.testIntegration("123e4567-e89b-12d3-a456-426614174000")).rejects.toThrow("Test failed")

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCount: 1,
          lastError: "Test failed",
          status: IntegrationStatus.ERROR,
        }),
      )
    })
  })

  describe("checkIntegrationHealth", () => {
    it("should return health information", async () => {
      mockRepository.findOne.mockResolvedValue(mockIntegration)

      const result = await service.checkIntegrationHealth("123e4567-e89b-12d3-a456-426614174000")

      expect(result).toEqual({
        id: mockIntegration.id,
        name: mockIntegration.name,
        status: mockIntegration.status,
        lastUsed: mockIntegration.lastUsed,
        errorCount: mockIntegration.errorCount,
        lastError: mockIntegration.lastError,
        uptime: expect.any(Number),
      })
    })
  })

  describe("findAll", () => {
    it("should return filtered integrations", async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockIntegration]),
      }
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder)

      const result = await service.findAll({
        developerId: "dev-123",
        type: IntegrationType.PRICE_FEED,
      })

      expect(result).toEqual([mockIntegration])
      expect(queryBuilder.andWhere).toHaveBeenCalledTimes(2)
    })
  })
})
