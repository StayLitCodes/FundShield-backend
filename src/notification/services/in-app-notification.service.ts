import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { NotificationHistory } from "../entities/notification-history.entity"
import type { NotificationGateway } from "../gateways/notification.gateway"
import type { TemplateService } from "./template.service"
import type { NotificationType } from "../enums/notification-type.enum"
import { NotificationStatus } from "../enums/notification-status.enum"

@Injectable()
export class InAppNotificationService {
  private readonly logger = new Logger(InAppNotificationService.name)

  constructor(
    private historyRepository: Repository<NotificationHistory>,
    private notificationGateway: NotificationGateway,
    private templateService: TemplateService,
  ) {}

  async sendInAppNotification(
    userId: string,
    notificationId: string,
    type: NotificationType,
    title: string,
    content: string,
    data?: Record<string, any>,
    templateId?: string,
    templateData?: Record<string, any>,
  ): Promise<boolean> {
    try {
      let finalTitle = title
      let finalContent = content

      // If template is provided, render it
      if (templateId) {
        const renderedTemplate = await this.templateService.renderTemplate(templateId, templateData || {})
        finalTitle = renderedTemplate.subject
        finalContent = renderedTemplate.content
      }

      // Save to history
      const historyEntry = this.historyRepository.create({
        userId,
        notificationId,
        type,
        title: finalTitle,
        content: finalContent,
        status: NotificationStatus.SENT,
        channels: ["in-app"],
      })

      await this.historyRepository.save(historyEntry)

      // Send real-time notification via WebSocket
      await this.notificationGateway.sendNotificationToUser(userId, {
        id: notificationId,
        type,
        title: finalTitle,
        content: finalContent,
        data,
        createdAt: new Date(),
      })

      this.logger.log(`In-app notification sent successfully to user ${userId}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to send in-app notification to user ${userId}:`, error)
      throw error
    }
  }

  async getUnreadNotifications(userId: string): Promise<NotificationHistory[]> {
    return this.historyRepository.find({
      where: {
        userId,
        readAt: null,
        channels: ["in-app"] as any,
      },
      order: { createdAt: "DESC" },
    })
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.historyRepository.update({ notificationId, userId }, { readAt: new Date() })
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.historyRepository.update({ userId, readAt: null }, { readAt: new Date() })
  }
}
