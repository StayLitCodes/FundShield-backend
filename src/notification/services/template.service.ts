import { Injectable, NotFoundException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { NotificationTemplate } from "../entities/notification-template.entity"
import type { CreateNotificationTemplateDto, UpdateNotificationTemplateDto } from "../dto/notification-template.dto"
import type { TemplateEngineUtil } from "../utils/template-engine.util"

@Injectable()
export class TemplateService {
  constructor(
    private templateRepository: Repository<NotificationTemplate>,
    private templateEngine: TemplateEngineUtil,
  ) {}

  async createTemplate(createTemplateDto: CreateNotificationTemplateDto): Promise<NotificationTemplate> {
    const template = this.templateRepository.create(createTemplateDto)
    return this.templateRepository.save(template)
  }

  async updateTemplate(id: string, updateTemplateDto: UpdateNotificationTemplateDto): Promise<NotificationTemplate> {
    const template = await this.getTemplateById(id)
    Object.assign(template, updateTemplateDto)
    return this.templateRepository.save(template)
  }

  async getTemplateById(id: string): Promise<NotificationTemplate> {
    const template = await this.templateRepository.findOne({ where: { id } })
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`)
    }
    return template
  }

  async getTemplateByName(name: string): Promise<NotificationTemplate> {
    const template = await this.templateRepository.findOne({ where: { name } })
    if (!template) {
      throw new NotFoundException(`Template with name ${name} not found`)
    }
    return template
  }

  async getAllTemplates(): Promise<NotificationTemplate[]> {
    return this.templateRepository.find({ where: { isActive: true } })
  }

  async deleteTemplate(id: string): Promise<void> {
    const result = await this.templateRepository.delete(id)
    if (result.affected === 0) {
      throw new NotFoundException(`Template with ID ${id} not found`)
    }
  }

  async renderTemplate(
    templateId: string,
    data: Record<string, any>,
  ): Promise<{
    subject: string
    content: string
    htmlContent?: string
  }> {
    const template = await this.getTemplateById(templateId)

    return {
      subject: this.templateEngine.render(template.subject, data),
      content: this.templateEngine.render(template.content, data),
      htmlContent: template.htmlContent ? this.templateEngine.render(template.htmlContent, data) : undefined,
    }
  }
}
