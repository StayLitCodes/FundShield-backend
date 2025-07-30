import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import type { Notification } from "../entities/notification.entity"
import type { NotificationHistory } from "../entities/notification-history.entity"
import type { CreateNotificationDto } from "../dto/create-notification.dto"
import type { BulkNotificationDto } from "../dto/bulk-notification.dto"
import { NotificationStatus } from "../enums/notification-status.enum"
import type { UserPreferenceService } from "./user-preference.service"
import type { TemplateService } from "./template.service"

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)

  constructor(
    private notificationRepository: Repository<Notification>,
    private historyRepository: Repository<NotificationHistory>,
    private emailQueue: Queue,
    private smsQueue: Queue,
    private pushQueue: Queue,
    private inAppQueue: Queue,
    private userPreferenceService: UserPreferenceService,
    private templateService: TemplateService,
  ) {}

  async createNotification(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create(createNotificationDto)
    const savedNotification = await this.notificationRepository.save(notification)

    // Process notification asynchronously
    await this.processNotification(savedNotification)

    return savedNotification
  }

  async createBulkNotifications(bulkNotificationDto: BulkNotificationDto): Promise<Notification[]> {
    const notifications = bulkNotificationDto.recipients.map((recipient) => {
      return this.notificationRepository.create({
        userId: recipient.userId,
        templateId: bulkNotificationDto.templateId,
        type: bulkNotificationDto.type,
        title: bulkNotificationDto.title,
        content: bulkNotificationDto.content,
        data: { ...bulkNotificationDto.data, ...recipient.personalizedData },
        channels: bulkNotificationDto.channels,
      })
    })

    const savedNotifications = await this.notificationRepository.save(notifications)

    // Process notifications asynchronously
    for (const notification of savedNotifications) {
      await this.processNotification(notification)
    }

    return savedNotifications
  }

  private async processNotification(notification: Notification): Promise<void> {
    try {
      // Get user preferences
      const preferences = await this.userPreferenceService.getUserPreferences(notification.userId)

      // Determine which channels to use
      const enabledChannels = this.getEnabledChannels(notification, preferences)

      // Update notification status
      await this.updateNotificationStatus(notification.id, NotificationStatus.PROCESSING)

      // Queue notifications for each enabled channel
      for (const channel of enabledChannels) {
        await this.queueNotification(notification, channel)
      }

      this.logger.log(`Notification ${notification.id} queued for channels: ${enabledChannels.join(", ")}`)
    } catch (error) {
      this.logger.error(`Failed to process notification ${notification.id}:`, error)
      await this.updateNotificationStatus(notification.id, NotificationStatus.FAILED, error.message)
    }
  }

  private getEnabledChannels(notification: Notification, preferences: any[]): string[] {
    const channels = notification.channels || ["email", "push", "in-app"]
    const enabledChannels = []

    const userPref = preferences.find((p) => p.notificationType === notification.type)

    if (!userPref) {
      return channels // Default to all channels if no preference found
    }

    if (channels.includes("email") && userPref.emailEnabled) {
      enabledChannels.push("email")
    }
    if (channels.includes("sms") && userPref.smsEnabled) {
      enabledChannels.push("sms")
    }
    if (channels.includes("push") && userPref.pushEnabled) {
      enabledChannels.push("push")
    }
    if (channels.includes("in-app") && userPref.inAppEnabled) {
      enabledChannels.push("in-app")
    }

    return enabledChannels
  }

  private async queueNotification(notification: Notification, channel: string): Promise<void> {
    const jobData = {
      notificationId: notification.id,
      userId: notification.userId,
      title: notification.title,
      content: notification.content,
      data: notification.data,
      templateId: notification.templateId,
    }

    const jobOptions = {
      attempts: notification.maxRetries,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      delay: notification.scheduledAt ? new Date(notification.scheduledAt).getTime() - Date.now() : 0,
    }

    switch (channel) {
      case "email":
        await this.emailQueue.add("send-email", jobData, jobOptions)
        break
      case "sms":
        await this.smsQueue.add("send-sms", jobData, jobOptions)
        break
      case "push":
        await this.pushQueue.add("send-push", jobData, jobOptions)
        break
      case "in-app":
        await this.inAppQueue.add("send-in-app", jobData, jobOptions)
        break
    }
  }

  async updateNotificationStatus(
    notificationId: string,
    status: NotificationStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.notificationRepository.update(notificationId, {
      status,
      errorMessage,
      sentAt: status === NotificationStatus.SENT ? new Date() : undefined,
    })
  }

  async getNotificationHistory(userId: string, page = 1, limit = 20): Promise<NotificationHistory[]> {
    return this.historyRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    })
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.historyRepository.update({ notificationId, userId }, { readAt: new Date() })
  }

  async getNotificationById(id: string): Promise<Notification> {
    return this.notificationRepository.findOne({
      where: { id },
      relations: ["template", "deliveryLogs"],
    })
  }

  async getNotifications(page = 1, limit = 20): Promise<Notification[]> {
    return this.notificationRepository.find({
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
      relations: ["template"],
    })
  }
}
