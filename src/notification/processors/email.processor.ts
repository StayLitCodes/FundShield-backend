import { Process, Processor } from "@nestjs/bull"
import type { Job } from "bull"
import { Logger } from "@nestjs/common"
import type { EmailService } from "../services/email.service"
import type { NotificationService } from "../services/notification.service"
import { NotificationStatus } from "../enums/notification-status.enum"
import type { Repository } from "typeorm"
import type { NotificationDeliveryLog } from "../entities/notification-delivery-log.entity"
import { DeliveryStatus } from "../enums/delivery-status.enum"

interface EmailJobData {
  notificationId: string
  userId: string
  title: string
  content: string
  data?: Record<string, any>
  templateId?: string
}

@Processor("email-queue")
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name)

  constructor(
    private emailService: EmailService,
    private notificationService: NotificationService,
    private deliveryLogRepository: Repository<NotificationDeliveryLog>,
  ) {}

  @Process("send-email")
  async handleSendEmail(job: Job<EmailJobData>) {
    const { notificationId, userId, title, content, data, templateId } = job.data

    try {
      this.logger.log(`Processing email job for notification ${notificationId}`)

      // Get user email (this would typically come from a user service)
      const userEmail = await this.getUserEmail(userId)

      if (!userEmail) {
        throw new Error(`No email found for user ${userId}`)
      }

      // Create delivery log
      const deliveryLog = this.deliveryLogRepository.create({
        notificationId,
        channel: "email",
        recipient: userEmail,
        status: DeliveryStatus.PENDING,
      })
      await this.deliveryLogRepository.save(deliveryLog)

      // Send email
      const success = await this.emailService.sendEmail(userEmail, title, content, undefined, templateId, data)

      if (success) {
        // Update delivery log
        await this.deliveryLogRepository.update(deliveryLog.id, {
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
        })

        // Update notification status
        await this.notificationService.updateNotificationStatus(notificationId, NotificationStatus.SENT)

        this.logger.log(`Email sent successfully for notification ${notificationId}`)
      } else {
        throw new Error("Email sending failed")
      }
    } catch (error) {
      this.logger.error(`Failed to send email for notification ${notificationId}:`, error)

      // Update delivery log with error
      const deliveryLog = await this.deliveryLogRepository.findOne({
        where: { notificationId, channel: "email" },
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

  private async getUserEmail(userId: string): Promise<string | null> {
    // This would typically fetch from a user service or database
    // For now, returning a mock email
    return `user-${userId}@example.com`
  }
}
