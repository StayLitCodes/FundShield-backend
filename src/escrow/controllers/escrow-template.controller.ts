import { Controller, Post, Get, Put, Delete, Param } from "@nestjs/common"
import type { EscrowTemplateService } from "../services/escrow-template.service"

@Controller("escrow-templates")
export class EscrowTemplateController {
  constructor(private readonly escrowTemplateService: EscrowTemplateService) {}

  @Post()
  async createTemplate(templateData: any) {
    return this.escrowTemplateService.createTemplate(templateData)
  }

  @Get()
  async getActiveTemplates() {
    return this.escrowTemplateService.getActiveTemplates()
  }

  @Get(":id")
  async getTemplateById(@Param("id") id: string) {
    return this.escrowTemplateService.getTemplateById(id)
  }

  @Put(":id")
  async updateTemplate(@Param("id") id: string, updateData: any) {
    return this.escrowTemplateService.updateTemplate(id, updateData)
  }

  @Delete(":id")
  async deactivateTemplate(@Param("id") id: string) {
    return this.escrowTemplateService.deactivateTemplate(id)
  }
}
