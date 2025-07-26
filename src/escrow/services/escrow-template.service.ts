import { Injectable, NotFoundException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { EscrowTemplate } from "../entities/escrow-template.entity"

@Injectable()
export class EscrowTemplateService {
  constructor(private templateRepository: Repository<EscrowTemplate>) {}

  async createTemplate(templateData: Partial<EscrowTemplate>): Promise<EscrowTemplate> {
    const template = this.templateRepository.create(templateData)
    return this.templateRepository.save(template)
  }

  async getTemplateById(id: string): Promise<EscrowTemplate> {
    const template = await this.templateRepository.findOne({ where: { id } })
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`)
    }
    return template
  }

  async getActiveTemplates(): Promise<EscrowTemplate[]> {
    return this.templateRepository.find({
      where: { isActive: true },
      order: { createdAt: "DESC" },
    })
  }

  async updateTemplate(id: string, updateData: Partial<EscrowTemplate>): Promise<EscrowTemplate> {
    const template = await this.getTemplateById(id)
    Object.assign(template, updateData)
    return this.templateRepository.save(template)
  }

  async deactivateTemplate(id: string): Promise<EscrowTemplate> {
    return this.updateTemplate(id, { isActive: false })
  }
}
