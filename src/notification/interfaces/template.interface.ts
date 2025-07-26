import type { NotificationType } from "../enums/notification-type.enum"

export interface ITemplate {
  id: string
  name: string
  subject: string
  content: string
  htmlContent?: string
  type: NotificationType
  variables: string[]
  metadata?: Record<string, any>
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface IRenderedTemplate {
  subject: string
  content: string
  htmlContent?: string
}

export interface ITemplateEngine {
  render(template: string, data: Record<string, any>): string
  extractVariables(template: string): string[]
  validateTemplate(
    template: string,
    data: Record<string, any>,
  ): {
    isValid: boolean
    missingVariables: string[]
  }
}
