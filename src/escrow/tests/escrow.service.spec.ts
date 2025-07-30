import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import { getQueueToken } from "@nestjs/bull"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import { EscrowService } from "../services/escrow.service"
import { Escrow } from "../entities/escrow.entity"
import { EscrowStateService } from "../services/escrow-state.service"
import { EscrowAuditService } from "../services/escrow-audit.service"
import { EscrowNotificationService } from "../services/escrow-notification.service"
import { EscrowValidationService } from "../services/escrow-validation.service"
import type { CreateEscrowDto } from "../dto/create-escrow.dto"
import { EscrowType } from "../enums/escrow-type.enum"
import { EscrowStatus } from "../enums/escrow-status.enum"
import { jest } from "@jest/globals"

describe("EscrowService", () => {
  let service: EscrowService
  let escrowRepository: Repository<Escrow>
  let escrowQueue: Queue

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockQueue = {
    add: jest.fn(),
  }

  const mockEscrowStateService = {
    canTransitionTo: jest.fn(),
    validateStateTransition: jest.fn(),
  }

  const mockEscrowAuditService = {
    logAction: jest.fn(),
    getEscrowHistory: jest.fn(),
  }

  const mockEscrowNotificationService = {
    sendEscrowCreatedNotification: jest.fn(),
    sendEscrowFundedNotification: jest.fn(),
  }

  const mockEscrowValidationService = {
    validateCreateEscrow: jest.fn(),
    validateEscrowUpdate: jest.fn(),
    validateFundRelease: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        {
          provide: getRepositoryToken(Escrow),
          useValue: mockRepository,
        },
        {
          provide: getQueueToken("escrow-queue"),
          useValue: mockQueue,
        },
        {
          provide: EscrowStateService,
          useValue: mockEscrowStateService,
        },
        {
          provide: EscrowAuditService,
          useValue: mockEscrowAuditService,
        },
        {
          provide: EscrowNotificationService,
          useValue: mockEscrowNotificationService,
        },
        {
          provide: EscrowValidationService,
          useValue: mockEscrowValidationService,
        },
      ],
    }).compile()

    service = module.get<EscrowService>(EscrowService)
    escrowRepository = module.get<Repository<Escrow>>(getRepositoryToken(Escrow))
    escrowQueue = module.get<Queue>(getQueueToken("escrow-queue"))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("createEscrow", () => {
    it("should create an escrow successfully", async () => {
      const createEscrowDto: CreateEscrowDto = {
        title: "Test Escrow",
        type: EscrowType.SIMPLE,
        buyerId: "buyer-123",
        sellerId: "seller-123",
        totalAmount: 1000,
        currency: "USD",
      }

      const mockEscrow = {
        id: "escrow-123",
        escrowNumber: "ESC-12345678-ABCD",
        ...createEscrowDto,
        status: EscrowStatus.CREATED,
        feeAmount: 25,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockEscrowValidationService.validateCreateEscrow.mockResolvedValue(undefined)
      mockRepository.create.mockReturnValue(mockEscrow)
      mockRepository.save.mockResolvedValue(mockEscrow)

      const result = await service.createEscrow(createEscrowDto, "creator-123")

      expect(mockEscrowValidationService.validateCreateEscrow).toHaveBeenCalledWith(createEscrowDto)
      expect(mockRepository.create).toHaveBeenCalled()
      expect(mockRepository.save).toHaveBeenCalledWith(mockEscrow)
      expect(mockEscrowAuditService.logAction).toHaveBeenCalled()
      expect(mockEscrowNotificationService.sendEscrowCreatedNotification).toHaveBeenCalledWith(mockEscrow)
      expect(result).toEqual(mockEscrow)
    })

    it("should create milestones when provided", async () => {
      const createEscrowDto: CreateEscrowDto = {
        title: "Test Escrow",
        type: EscrowType.MILESTONE,
        buyerId: "buyer-123",
        sellerId: "seller-123",
        totalAmount: 1000,
        isMultiMilestone: true,
        milestones: [
          { title: "Milestone 1", percentage: 50 },
          { title: "Milestone 2", percentage: 50 },
        ],
      }

      const mockEscrow = {
        id: "escrow-123",
        escrowNumber: "ESC-12345678-ABCD",
        ...createEscrowDto,
        status: EscrowStatus.CREATED,
        feeAmount: 25,
      }

      mockEscrowValidationService.validateCreateEscrow.mockResolvedValue(undefined)
      mockRepository.create.mockReturnValue(mockEscrow)
      mockRepository.save.mockResolvedValue(mockEscrow)

      await service.createEscrow(createEscrowDto, "creator-123")

      expect(mockQueue.add).toHaveBeenCalledWith("create-milestones", {
        escrowId: mockEscrow.id,
        milestones: createEscrowDto.milestones,
      })
    })
  })

  describe("fundEscrow", () => {
    it("should fund an escrow successfully", async () => {
      const mockEscrow = {
        id: "escrow-123",
        escrowNumber: "ESC-12345678-ABCD",
        status: EscrowStatus.CREATED,
        totalAmount: 1000,
        lockedAmount: 0,
        fundedAt: null,
      }

      const updatedEscrow = {
        ...mockEscrow,
        status: EscrowStatus.FUNDED,
        lockedAmount: 1000,
        fundedAt: new Date(),
      }

      mockRepository.findOne.mockResolvedValue(mockEscrow)
      mockEscrowStateService.canTransitionTo.mockReturnValue(true)
      mockRepository.save.mockResolvedValue(updatedEscrow)

      const result = await service.fundEscrow("escrow-123", "funder-123")

      expect(mockEscrowStateService.canTransitionTo).toHaveBeenCalledWith(EscrowStatus.CREATED, EscrowStatus.FUNDED)
      expect(mockRepository.save).toHaveBeenCalled()
      expect(mockQueue.add).toHaveBeenCalledWith(
        "create-transaction",
        expect.objectContaining({
          escrowId: "escrow-123",
          type: "deposit",
          amount: 1000,
          initiatedBy: "funder-123",
        }),
      )
      expect(mockEscrowNotificationService.sendEscrowFundedNotification).toHaveBeenCalledWith(updatedEscrow)
      expect(result.status).toBe(EscrowStatus.FUNDED)
    })

    it("should throw error for invalid state transition", async () => {
      const mockEscrow = {
        id: "escrow-123",
        status: EscrowStatus.COMPLETED,
        totalAmount: 1000,
      }

      mockRepository.findOne.mockResolvedValue(mockEscrow)
      mockEscrowStateService.canTransitionTo.mockReturnValue(false)

      await expect(service.fundEscrow("escrow-123", "funder-123")).rejects.toThrow(
        "Cannot fund escrow in completed status",
      )
    })
  })

  describe("releaseEscrowFunds", () => {
    it("should release funds successfully", async () => {
      const mockEscrow = {
        id: "escrow-123",
        escrowNumber: "ESC-12345678-ABCD",
        status: EscrowStatus.FUNDED,
        totalAmount: 1000,
        lockedAmount: 1000,
        releasedAmount: 0,
      }

      const updatedEscrow = {
        ...mockEscrow,
        status: EscrowStatus.COMPLETED,
        lockedAmount: 0,
        releasedAmount: 1000,
        completedAt: new Date(),
      }

      mockRepository.findOne.mockResolvedValue(mockEscrow)
      mockEscrowValidationService.validateFundRelease.mockResolvedValue(undefined)
      mockRepository.save.mockResolvedValue(updatedEscrow)

      const result = await service.releaseEscrowFunds("escrow-123", "releaser-123")

      expect(mockEscrowValidationService.validateFundRelease).toHaveBeenCalledWith(
        mockEscrow,
        "releaser-123",
        undefined,
      )
      expect(mockRepository.save).toHaveBeenCalled()
      expect(mockQueue.add).toHaveBeenCalledWith(
        "create-transaction",
        expect.objectContaining({
          escrowId: "escrow-123",
          type: "release",
          amount: 1000,
          initiatedBy: "releaser-123",
        }),
      )
      expect(result.status).toBe(EscrowStatus.COMPLETED)
    })
  })

  describe("getEscrowStatistics", () => {
    it("should return escrow statistics", async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn(),
        clone: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
      }

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)
      mockQueryBuilder.getCount.mockResolvedValue(100)
      mockQueryBuilder.getRawOne.mockResolvedValue({ sum: "50000" })

      const result = await service.getEscrowStatistics("user-123")

      expect(result).toHaveProperty("total")
      expect(result).toHaveProperty("byStatus")
      expect(result).toHaveProperty("totalValue")
      expect(result).toHaveProperty("completionRate")
    })
  })
})
