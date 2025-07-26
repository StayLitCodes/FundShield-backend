import { Process, Processor } from "@nestjs/bull"
import type { Job } from "bull"
import { Logger } from "@nestjs/common"
import type { PushNotificationService } from "../services/push-notification.service"
import type { NotificationService } from "../services/notification.service"
import { NotificationStatus } from "../enums/notification-status.enum"
import type { Repository } from "typeorm"
import type { NotificationDeliveryLog } from "../entities/notification-delivery-log.entity"
import { DeliveryStatus } from "../enums/delivery-status.enum"

interface PushJobData {
  notificationId: string
  userId: string
  title: string
  content: string
  data?: Record<string, any>
  templateId?: string
}

@Processor("push-queue")
export class PushProcessor {
  private readonly logger = new Logger(PushProcessor.name)

  constructor(
    private pushNotificationService: PushNotificationService,
    private notificationService: NotificationService,
    private deliveryLogRepository: Repository<NotificationDeliveryLog>,
  ) {}

  @Process("send-push")
  async handleSendPush(job: Job<PushJobData>) {
    const { notificationId, userId, title, content, data, templateId } = job.data

    try {
      this.logger.log(`Processing push notification job for notification ${notificationId}`)

      // Get user device tokens
      const deviceTokens = await this.getUserDeviceTokens(userId)

      if (!deviceTokens || deviceTokens.length === 0) {
        throw new Error(`No device tokens found for user ${userId}`)
      }

      // Send to all user devices
      for (const deviceToken of deviceTokens) {
        // Create delivery log
        const deliveryLog = this.deliveryLogRepository.create({
          notificationId,
          channel: "push",
          recipient: deviceToken,
          status: DeliveryStatus.PENDING,
        })
        await this.deliveryLogRepository.save(deliveryLog)

        try {
          // Send push notification
          const success = await this.pushNotificationService.sendPushNotification(
            deviceToken,
            title,
            content,
            data,
            templateId,
            data,
          )

          if (success) {
            // Update delivery log
            await this.deliveryLogRepository.update(deliveryLog.id, {
              status: DeliveryStatus.SENT,
              sentAt: new Date(),
            })
          } else {
            throw new Error("Push notification sending failed")
          }
        } catch (deviceError) {
          // Update delivery log with error for this specific device
          await this.deliveryLogRepository.update(deliveryLog.id, {
            status: DeliveryStatus.FAILED,
            errorMessage: deviceError.message,
          })

          this.logger.warn(`Failed to send push to device ${deviceToken}:`, deviceError)
        }
      }

      // Update notification status
      await this.notificationService.updateNotificationStatus(notificationId, NotificationStatus.SENT)

      this.logger.log(`Push notifications sent for notification ${notificationId}`)
    } catch (error) {
      this.logger.error(`Failed to send push notifications for notification ${notificationId}:`, error)

      // Update notification status
      await this.notificationService.updateNotificationStatus(notificationId, NotificationStatus.FAILED, error.message)

      throw error
    }
  }

  private async getUserDeviceTokens(userId: string): Promise<string[]> {
    // This would typically fetch from a user service or database
    // For now, returning mock device tokens
    return [`device_token_${userId}_1`, `device_token_${userId}_2`]
  }
}
