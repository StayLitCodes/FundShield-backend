import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import { getQueueToken } from "@nestjs/bull"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import { NotificationService } from "../services/notification.service"
import { Notification } from "../entities/notification.entity"
import { NotificationHistory } from "../entities/notification-history.entity"
import { UserPreferenceService } from "../services/user-preference.service"
import { TemplateService } from "../services/template.service"
import type { CreateNotificationDto } from "../dto/create-notification.dto"
import { NotificationType } from "../enums/notification-type.enum"
import { NotificationStatus } from "../enums/notification-status.enum"
import { jest } from "@jest/globals" // Import jest to fix the undeclared variable error

describe("NotificationService", () => {
  let service: NotificationService
  let notificationRepository: Repository<Notification>
  let historyRepository: Repository<NotificationHistory>
  let emailQueue: Queue
  let smsQueue: Queue
  let pushQueue: Queue
  let inAppQueue: Queue
  let userPreferenceService: UserPreferenceService
  let templateService: TemplateService

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }

  const mockQueue = {
    add: jest.fn(),
  }

  const mockUserPreferenceService = {
    getUserPreferences: jest.fn(),
  }

  const mockTemplateService = {
    renderTemplate: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(NotificationHistory),
          useValue: mockRepository,
        },
        {
          provide: getQueueToken("email-queue"),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken("sms-queue"),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken("push-queue"),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken("in-app-queue"),
          useValue: mockQueue,
        },
        {
          provide: UserPreferenceService,
          useValue: mockUserPreferenceService,
        },
        {
          provide: TemplateService,
          useValue: mockTemplateService,
        },
      ],
    }).compile()

    service = module.get<NotificationService>(NotificationService)
    notificationRepository = module.get<Repository<Notification>>(getRepositoryToken(Notification))
    historyRepository = module.get<Repository<NotificationHistory>>(getRepositoryToken(NotificationHistory))
    emailQueue = module.get<Queue>(getQueueToken("email-queue"))
    smsQueue = module.get<Queue>(getQueueToken("sms-queue"))
    pushQueue = module.get<Queue>(getQueueToken("push-queue"))
    inAppQueue = module.get<Queue>(getQueueToken("in-app-queue"))
    userPreferenceService = module.get<UserPreferenceService>(UserPreferenceService)
    templateService = module.get<TemplateService>(TemplateService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("createNotification", () => {
    it("should create and process a notification", async () => {
      const createNotificationDto: CreateNotificationDto = {
        userId: "user-123",
        type: NotificationType.WELCOME,
        title: "Welcome!",
        content: "Welcome to our platform",
        channels: ["email", "push"],
      }

      const mockNotification = {
        id: "notification-123",
        ...createNotificationDto,
        status: NotificationStatus.PENDING,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRepository.create.mockReturnValue(mockNotification)
      mockRepository.save.mockResolvedValue(mockNotification)
      mockUserPreferenceService.getUserPreferences.mockResolvedValue([
        {
          userId: "user-123",
          notificationType: NotificationType.WELCOME,
          emailEnabled: true,
          pushEnabled: true,
          smsEnabled: false,
          inAppEnabled: true,
        },
      ])

      const result = await service.createNotification(createNotificationDto)

      expect(mockRepository.create).toHaveBeenCalledWith(createNotificationDto)
      expect(mockRepository.save).toHaveBeenCalledWith(mockNotification)
      expect(result).toEqual(mockNotification)
    })
  })

  describe("updateNotificationStatus", () => {
    it("should update notification status", async () => {
      const notificationId = "notification-123"
      const status = NotificationStatus.SENT

      await service.updateNotificationStatus(notificationId, status)

      expect(mockRepository.update).toHaveBeenCalledWith(notificationId, {
        status,
        errorMessage: undefined,
        sentAt: expect.any(Date),
      })
    })

    it("should update notification status with error message", async () => {
      const notificationId = "notification-123"
      const status = NotificationStatus.FAILED
      const errorMessage = "Failed to send"

      await service.updateNotificationStatus(notificationId, status, errorMessage)

      expect(mockRepository.update).toHaveBeenCalledWith(notificationId, {
        status,
        errorMessage,
        sentAt: undefined,
      })
    })
  })

  describe("getNotificationHistory", () => {
    it("should return user notification history", async () => {
      const userId = "user-123"
      const mockHistory = [
        {
          id: "history-1",
          userId,
          notificationId: "notification-1",
          type: NotificationType.WELCOME,
          title: "Welcome",
          content: "Welcome message",
          status: NotificationStatus.SENT,
          createdAt: new Date(),
        },
      ]

      mockRepository.find.mockResolvedValue(mockHistory)

      const result = await service.getNotificationHistory(userId)

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: "DESC" },
        skip: 0,
        take: 20,
      })
      expect(result).toEqual(mockHistory)
    })
  })

  describe("markAsRead", () => {
    it("should mark notification as read", async () => {
      const notificationId = "notification-123"
      const userId = "user-123"

      await service.markAsRead(notificationId, userId)

      expect(mockRepository.update).toHaveBeenCalledWith({ notificationId, userId }, { readAt: expect.any(Date) })
    })
  })
})
