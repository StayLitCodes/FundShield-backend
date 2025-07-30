import { Injectable, Logger } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"

interface EmailData {
  to: string
  subject: string
  text: string
  html?: string
  from?: string
}

@Injectable()
export class SendGridProvider {
  private readonly logger = new Logger(SendGridProvider.name)
  private readonly apiKey: string
  private readonly fromEmail: string

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>("SENDGRID_API_KEY")
    this.fromEmail = this.configService.get<string>("SENDGRID_FROM_EMAIL", "noreply@example.com")
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      // Mock SendGrid implementation
      // In a real implementation, you would use @sendgrid/mail
      this.logger.log(`Sending email via SendGrid to ${emailData.to}`)
      this.logger.log(`Subject: ${emailData.subject}`)

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Mock successful response
      return true
    } catch (error) {
      this.logger.error("SendGrid email sending failed:", error)
      throw error
    }
  }

  async sendBulkEmail(emails: EmailData[]): Promise<boolean> {
    try {
      this.logger.log(`Sending bulk email via SendGrid to ${emails.length} recipients`)

      // Mock bulk sending
      const promises = emails.map((email) => this.sendEmail(email))
      await Promise.all(promises)

      return true
    } catch (error) {
      this.logger.error("SendGrid bulk email sending failed:", error)
      throw error
    }
  }
}
