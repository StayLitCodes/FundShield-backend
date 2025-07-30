import { Injectable, Logger } from "@nestjs/common"
import type { TwilioProvider } from "../providers/twilio.provider"
import type { TemplateService } from "./template.service"

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)

  constructor(
    private twilioProvider: TwilioProvider,
    private templateService: TemplateService,
  ) {}

  async sendSms(
    to: string,
    message: string,
    templateId?: string,
    templateData?: Record<string, any>,
  ): Promise<boolean> {
    try {
      let finalMessage = message

      // If template is provided, render it
      if (templateId) {
        const renderedTemplate = await this.templateService.renderTemplate(templateId, templateData || {})
        finalMessage = renderedTemplate.content
      }

      const result = await this.twilioProvider.sendSms(to, finalMessage)
      this.logger.log(`SMS sent successfully to ${to}`)
      return result
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}:`, error)
      throw error
    }
  }

  async sendBulkSms(
    recipients: Array<{
      to: string
      personalizations?: Record<string, any>
    }>,
    message: string,
    templateId?: string,
  ): Promise<boolean> {
    try {
      const smsPromises = recipients.map((recipient) =>
        this.sendSms(recipient.to, message, templateId, recipient.personalizations),
      )

      await Promise.all(smsPromises)
      this.logger.log(`Bulk SMS sent to ${recipients.length} recipients`)
      return true
    } catch (error) {
      this.logger.error("Failed to send bulk SMS:", error)
      throw error
    }
  }
}
