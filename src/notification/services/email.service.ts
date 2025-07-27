import { Injectable, Logger } from "@nestjs/common"
import type { SendGridProvider } from "../providers/sendgrid.provider"
import type { TemplateService } from "./template.service"

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)

  constructor(
    private sendGridProvider: SendGridProvider,
    private templateService: TemplateService,
  ) {}

  async sendEmail(
    to: string,
    subject: string,
    content: string,
    htmlContent?: string,
    templateId?: string,
    templateData?: Record<string, any>,
  ): Promise<boolean> {
    try {
      let finalSubject = subject
      let finalContent = content
      let finalHtmlContent = htmlContent

      // If template is provided, render it
      if (templateId) {
        const renderedTemplate = await this.templateService.renderTemplate(templateId, templateData || {})
        finalSubject = renderedTemplate.subject
        finalContent = renderedTemplate.content
        finalHtmlContent = renderedTemplate.htmlContent
      }

      const result = await this.sendGridProvider.sendEmail({
        to,
        subject: finalSubject,
        text: finalContent,
        html: finalHtmlContent,
      })

      this.logger.log(`Email sent successfully to ${to}`)
      return result
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error)
      throw error
    }
  }

  async sendBulkEmail(
    recipients: Array<{
      to: string
      personalizations?: Record<string, any>
    }>,
    subject: string,
    content: string,
    htmlContent?: string,
    templateId?: string,
  ): Promise<boolean> {
    try {
      const emailPromises = recipients.map((recipient) =>
        this.sendEmail(recipient.to, subject, content, htmlContent, templateId, recipient.personalizations),
      )

      await Promise.all(emailPromises)
      this.logger.log(`Bulk email sent to ${recipients.length} recipients`)
      return true
    } catch (error) {
      this.logger.error("Failed to send bulk email:", error)
      throw error
    }
  }
}
