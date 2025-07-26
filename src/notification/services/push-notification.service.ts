import { Injectable, Logger } from "@nestjs/common"
import type { FirebaseProvider } from "../providers/firebase.provider"
import type { TemplateService } from "./template.service"

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name)

  constructor(
    private firebaseProvider: FirebaseProvider,
    private templateService: TemplateService,
  ) {}

  async sendPushNotification(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    templateId?: string,
    templateData?: Record<string, any>,
  ): Promise<boolean> {
    try {
      let finalTitle = title
      let finalBody = body

      // If template is provided, render it
      if (templateId) {
        const renderedTemplate = await this.templateService.renderTemplate(templateId, templateData || {})
        finalTitle = renderedTemplate.subject
        finalBody = renderedTemplate.content
      }

      const result = await this.firebaseProvider.sendPushNotification({
        token: deviceToken,
        title: finalTitle,
        body: finalBody,
        data,
      })

      this.logger.log(`Push notification sent successfully to device ${deviceToken}`)
      return result
    } catch (error) {
      this.logger.error(`Failed to send push notification to ${deviceToken}:`, error)
      throw error
    }
  }

  async sendBulkPushNotification(
    recipients: Array<{
      deviceToken: string
      personalizations?: Record<string, any>
    }>,
    title: string,
    body: string,
    data?: Record<string, any>,
    templateId?: string,
  ): Promise<boolean> {
    try {
      const pushPromises = recipients.map((recipient) =>
        this.sendPushNotification(
          recipient.deviceToken,
          title,
          body,
          { ...data, ...recipient.personalizations },
          templateId,
          recipient.personalizations,
        ),
      )

      await Promise.all(pushPromises)
      this.logger.log(`Bulk push notifications sent to ${recipients.length} devices`)
      return true
    } catch (error) {
      this.logger.error("Failed to send bulk push notifications:", error)
      throw error
    }
  }
}
