import { Controller, Param } from "@nestjs/common"
import type { TemplateService } from "../services/template.service"
import type { CreateNotificationTemplateDto, UpdateNotificationTemplateDto } from "../dto/notification-template.dto"
import type { NotificationTemplate } from "../entities/notification-template.entity"

@Controller("notification-templates")
export class NotificationTemplateController {
  constructor(private readonly templateService: TemplateService) {}

  createTemplate(createTemplateDto: CreateNotificationTemplateDto): Promise<NotificationTemplate> {
    return this.templateService.createTemplate(createTemplateDto)
  }

  getAllTemplates(): Promise<NotificationTemplate[]> {
    return this.templateService.getAllTemplates()
  }

  getTemplateById(@Param('id') id: string): Promise<NotificationTemplate> {
    return this.templateService.getTemplateById(id);
  }

  getTemplateByName(@Param('name') name: string): Promise<NotificationTemplate> {
    return this.templateService.getTemplateByName(name);
  }

  updateTemplate(
    @Param('id') id: string,
    updateTemplateDto: UpdateNotificationTemplateDto,
  ): Promise<NotificationTemplate> {
    return this.templateService.updateTemplate(id, updateTemplateDto)
  }

  deleteTemplate(@Param('id') id: string): Promise<void> {
    return this.templateService.deleteTemplate(id);
  }

  renderTemplate(
    @Param('id') id: string,
    data: Record<string, any>,
  ): Promise<{ subject: string; content: string; htmlContent?: string }> {
    return this.templateService.renderTemplate(id, data)
  }
}
