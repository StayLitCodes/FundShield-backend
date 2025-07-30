import { IsString, IsEnum, IsOptional, IsArray, IsObject, IsBoolean } from "class-validator"
import { NotificationType } from "../enums/notification-type.enum"

export class CreateNotificationTemplateDto {
  @IsString()
  name: string

  @IsString()
  subject: string

  @IsString()
  content: string

  @IsOptional()
  @IsString()
  htmlContent?: string

  @IsEnum(NotificationType)
  type: NotificationType

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[]

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  subject?: string

  @IsOptional()
  @IsString()
  content?: string

  @IsOptional()
  @IsString()
  htmlContent?: string

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[]

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
