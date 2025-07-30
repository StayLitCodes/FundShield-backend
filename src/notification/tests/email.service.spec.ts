import { Test, type TestingModule } from "@nestjs/testing"
import { EmailService } from "../services/email.service"
import { SendGridProvider } from "../providers/sendgrid.provider"
import { TemplateService } from "../services/template.service"
import { jest } from "@jest/globals"

describe("EmailService", () => {
  let service: EmailService
  let sendGridProvider: SendGridProvider
  let templateService: TemplateService

  const mockSendGridProvider = {
    sendEmail: jest.fn(),
  }

  const mockTemplateService = {
    renderTemplate: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: SendGridProvider,
          useValue: mockSendGridProvider,
        },
        {
          provide: TemplateService,
          useValue: mockTemplateService,
        },
      ],
    }).compile()

    service = module.get<EmailService>(EmailService)
    sendGridProvider = module.get<SendGridProvider>(SendGridProvider)
    templateService = module.get<TemplateService>(TemplateService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("sendEmail", () => {
    it("should send email successfully", async () => {
      const to = "test@example.com"
      const subject = "Test Subject"
      const content = "Test Content"

      mockSendGridProvider.sendEmail.mockResolvedValue(true)

      const result = await service.sendEmail(to, subject, content)

      expect(mockSendGridProvider.sendEmail).toHaveBeenCalledWith({
        to,
        subject,
        text: content,
        html: undefined,
      })
      expect(result).toBe(true)
    })

    it("should send email with template", async () => {
      const to = "test@example.com"
      const subject = "Test Subject"
      const content = "Test Content"
      const templateId = "template-123"
      const templateData = { name: "John" }

      const renderedTemplate = {
        subject: "Hello John",
        content: "Welcome John!",
        htmlContent: "<h1>Welcome John!</h1>",
      }

      mockTemplateService.renderTemplate.mockResolvedValue(renderedTemplate)
      mockSendGridProvider.sendEmail.mockResolvedValue(true)

      const result = await service.sendEmail(to, subject, content, undefined, templateId, templateData)

      expect(mockTemplateService.renderTemplate).toHaveBeenCalledWith(templateId, templateData)
      expect(mockSendGridProvider.sendEmail).toHaveBeenCalledWith({
        to,
        subject: renderedTemplate.subject,
        text: renderedTemplate.content,
        html: renderedTemplate.htmlContent,
      })
      expect(result).toBe(true)
    })

    it("should handle email sending failure", async () => {
      const to = "test@example.com"
      const subject = "Test Subject"
      const content = "Test Content"
      const error = new Error("SendGrid error")

      mockSendGridProvider.sendEmail.mockRejectedValue(error)

      await expect(service.sendEmail(to, subject, content)).rejects.toThrow(error)
    })
  })

  describe("sendBulkEmail", () => {
    it("should send bulk emails successfully", async () => {
      const recipients = [{ to: "user1@example.com" }, { to: "user2@example.com" }]
      const subject = "Bulk Subject"
      const content = "Bulk Content"

      mockSendGridProvider.sendEmail.mockResolvedValue(true)

      const result = await service.sendBulkEmail(recipients, subject, content)

      expect(mockSendGridProvider.sendEmail).toHaveBeenCalledTimes(2)
      expect(result).toBe(true)
    })
  })
})
