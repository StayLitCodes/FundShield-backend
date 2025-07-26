import { Process, Processor } from "@nestjs/bull"
import type { Job } from "bull"
import { Logger } from "@nestjs/common"
import type { SmsService } from "../services/sms.service"
import type { NotificationService } from "../services/notification.service"
import { NotificationStatus } from "../enums/notification-status.enum"
import type { Repository } from "typeorm"
import type { NotificationDeliveryLog } from "../entities/notification-delivery-log.entity"
import { DeliveryStatus } from "../enums/delivery-status.enum"

interface SmsJobData {
  notificationId: string
  userId: string
  title: string
  content: string
  data?: Record<string, any>
  templateId?: string
}

@Processor("sms-queue")
export class SmsProcessor {
  private readonly logger = new Logger(SmsProcessor.name)

  constructor(
    private smsService: SmsService,
    private notificationService: NotificationService,
    private deliveryLogRepository: Repository<NotificationDeliveryLog>,
  ) {}

  @Process("send-sms")
  async handleSendSms(job: Job<SmsJobData>) {
    const { notificationId, userId, content, data, templateId } = job.data

    try {
      this.logger.log(`Processing SMS job for notification ${notificationId}`)

      // Get user phone number
      const userPhone = await this.getUserPhone(userId)

      if (!userPhone) {
        throw new Error(`No phone number found for user ${userId}`)
      }

      // Create delivery log
      const deliveryLog = this.deliveryLogRepository.create({
        notificationId,
        channel: "sms",
        recipient: userPhone,
        status: DeliveryStatus.PENDING,
      })
      await this.deliveryLogRepository.save(deliveryLog)

      // Send SMS
      const success = await this.smsService.sendSms(userPhone, content, templateId, data)

      if (success) {
        // Update delivery log
        await this.deliveryLogRepository.update(deliveryLog.id, {
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
        })

        // Update notification status
        await this.notificationService.updateNotificationStatus(notificationId, NotificationStatus.SENT)

        this.logger.log(`SMS sent successfully for notification ${notificationId}`)
      } else {
        throw new Error("SMS sending failed")
      }
    } catch (error) {
      this.logger.error(`Failed to send SMS for notification ${notificationId}:`, error)

      // Update delivery log with error
      const deliveryLog = await this.deliveryLogRepository.findOne({
        where: { notificationId, channel: "sms" },
      })

      if (deliveryLog) {
        await this.deliveryLogRepository.update(deliveryLog.id, {
          status: DeliveryStatus.FAILED,
          errorMessage: error.message,
        })
      }

      // Update notification status
      await this.notificationService.updateNotificationStatus(notificationId, NotificationStatus.FAILED, error.message)

      throw error
    }
  }

  private async getUserPhone(userId: string): Promise<string | null> {
    // This would typically fetch from a user service or database
    // For now, returning a mock phone number
    return `+1234567890${userId.slice(-3)}`
  }
}
