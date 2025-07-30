import { Process, Processor } from "@nestjs/bull"
import type { Job } from "bull"
import { Logger } from "@nestjs/common"
import type { InAppNotificationService } from "../services/in-app-notification.service"
import type { NotificationService } from "../services/notification.service"
import { NotificationStatus } from "../enums/notification-status.enum"
import type { NotificationType } from "../enums/notification-type.enum"

interface InAppJobData {
  notificationId: string
  userId: string
  title: string
  content: string
  type: NotificationType
  data?: Record<string, any>
  templateId?: string
}

@Processor("in-app-queue")
export class InAppProcessor {
  private readonly logger = new Logger(InAppProcessor.name)

  constructor(
    private inAppNotificationService: InAppNotificationService,
    private notificationService: NotificationService,
  ) {}

  @Process("send-in-app")
  async handleSendInApp(job: Job<InAppJobData>) {
    const { notificationId, userId, title, content, type, data, templateId } = job.data

    try {
      this.logger.log(`Processing in-app notification job for notification ${notificationId}`)

      // Send in-app notification
      const success = await this.inAppNotificationService.sendInAppNotification(
        userId,
        notificationId,
        type,
        title,
        content,
        data,
        templateId,
        data,
      )

      if (success) {
        // Update notification status
        await this.notificationService.updateNotificationStatus(notificationId, NotificationStatus.SENT)

        this.logger.log(`In-app notification sent successfully for notification ${notificationId}`)
      } else {
        throw new Error("In-app notification sending failed")
      }
    } catch (error) {
      this.logger.error(`Failed to send in-app notification for notification ${notificationId}:`, error)

      // Update notification status
      await this.notificationService.updateNotificationStatus(notificationId, NotificationStatus.FAILED, error.message)

      throw error
    }
  }
}
