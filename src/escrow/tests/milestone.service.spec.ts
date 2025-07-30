import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import { getQueueToken } from "@nestjs/bull"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import { MilestoneService } from "../services/milestone.service"
import { EscrowMilestone } from "../entities/escrow-milestone.entity"
import { EscrowService } from "../services/escrow.service"
import { EscrowAuditService } from "../services/escrow-audit.service"
import { EscrowNotificationService } from "../services/escrow-notification.service"
import type { CreateMilestoneDto } from "../dto/milestone.dto"
import { MilestoneStatus } from "../enums/milestone-status.enum"
import { jest } from "@jest/globals"

describe("MilestoneService", () => {
  let service: MilestoneService
  let milestoneRepository: Repository<EscrowMilestone>
  let milestoneQueue: Queue

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  }

  const mockQueue = {
    add: jest.fn(),
  }

  const mockEscrowService = {
    getEscrowById: jest.fn(),
  }

  const mockEscrowAuditService = {
    logAction: jest.fn(),
  }

  const mockEscrowNotificationService = {
    sendMilestoneCreatedNotification: jest.fn(),
    sendMilestoneStartedNotification: jest.fn(),
    sendMilestoneApprovedNotification: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MilestoneService,
        {
          provide: getRepositoryToken(EscrowMilestone),
          useValue: mockRepository,
        },
        {
          provide: getQueueToken("milestone-queue"),
          useValue: mockQueue,
        },
        {
          provide: EscrowService,
          useValue: mockEscrowService,
        },
        {
          provide: EscrowAuditService,
          useValue: mockEscrowAuditService,
        },
        {
          provide: EscrowNotificationService,
          useValue: mockEscrowNotificationService,
        },
      ],
    }).compile()

    service = module.get<MilestoneService>(MilestoneService)
    milestoneRepository = module.get<Repository<EscrowMilestone>>(getRepositoryToken(EscrowMilestone))
    milestoneQueue = module.get<Queue>(getQueueToken("milestone-queue"))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("createMilestone", () => {
    it("should create a milestone successfully", async () => {
      const createMilestoneDto: CreateMilestoneDto = {
        escrowId: "escrow-123",
        title: "Test Milestone",
        order: 1,
        amount: 500,
        percentage: 50,
      }

      const mockEscrow = {
        id: "escrow-123",
        totalAmount: 1000,
        escrowNumber: "ESC-12345678-ABCD",
      }

      const mockMilestone = {
        id: "milestone-123",
        ...createMilestoneDto,
        status: MilestoneStatus.PENDING,
        requirements: [],
        deliverables: [],
        createdAt: new Date(),
      }

      mockEscrowService.getEscrowById.mockResolvedValue(mockEscrow)
      mockRepository.create.mockReturnValue(mockMilestone)
      mockRepository.save.mockResolvedValue(mockMilestone)

      const result = await service.createMilestone(createMilestoneDto, "creator-123")

      expect(mockEscrowService.getEscrowById).toHaveBeenCalledWith("escrow-123")
      expect(mockRepository.create).toHaveBeenCalled()
      expect(mockRepository.save).toHaveBeenCalledWith(mockMilestone)
      expect(mockEscrowAuditService.logAction).toHaveBeenCalled()
      expect(mockEscrowNotificationService.sendMilestoneCreatedNotification).toHaveBeenCalledWith(
        mockEscrow,
        mockMilestone,
      )
      expect(result).toEqual(mockMilestone)
    })
  })

  describe("approveMilestone", () => {
    it("should approve a milestone successfully", async () => {
      const mockMilestone = {
        id: "milestone-123",
        escrowId: "escrow-123",
        title: "Test Milestone",
        status: MilestoneStatus.SUBMITTED,
        amount: 500,
        escrow: { id: "escrow-123" },
      }

      const approvedMilestone = {
        ...mockMilestone,
        status: MilestoneStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: "approver-123",
        approvalNotes: "Looks good!",
      }

      mockRepository.findOne.mockResolvedValue(mockMilestone)
      mockRepository.save.mockResolvedValue(approvedMilestone)

      const result = await service.approveMilestone(
        "milestone-123",
        {
          approvalNotes: "Looks good!",
        },
        "approver-123",
      )

      expect(mockRepository.save).toHaveBeenCalled()
      expect(mockQueue.add).toHaveBeenCalledWith("release-milestone-funds", {
        milestoneId: "milestone-123",
        amount: 500,
        releasedBy: "approver-123",
      })
      expect(mockEscrowNotificationService.sendMilestoneApprovedNotification).toHaveBeenCalled()
      expect(result.status).toBe(MilestoneStatus.APPROVED)
    })

    it("should throw error for invalid milestone status", async () => {
      const mockMilestone = {
        id: "milestone-123",
        status: MilestoneStatus.PENDING,
      }

      mockRepository.findOne.mockResolvedValue(mockMilestone)

      await expect(service.approveMilestone("milestone-123", {}, "approver-123")).rejects.toThrow(
        "Cannot approve milestone in pending status",
      )
    })
  })

  describe("getMilestoneProgress", () => {
    it("should return milestone progress", async () => {
      const mockMilestones = [
        { id: "1", status: MilestoneStatus.COMPLETED, order: 1 },
        { id: "2", status: MilestoneStatus.IN_PROGRESS, order: 2 },
        { id: "3", status: MilestoneStatus.PENDING, order: 3 },
      ]

      mockRepository.find.mockResolvedValue(mockMilestones)

      const result = await service.getMilestoneProgress("escrow-123")

      expect(result).toEqual({
        totalMilestones: 3,
        completedMilestones: 1,
        progressPercentage: 33.333333333333336,
        currentMilestone: mockMilestones[1],
        nextMilestone: mockMilestones[2],
      })
    })
  })
})
