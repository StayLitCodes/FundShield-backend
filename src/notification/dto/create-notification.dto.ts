import { IsString, IsUUID, IsEnum, IsOptional, IsArray, IsObject, IsDateString } from "class-validator"
import { NotificationType } from "../enums/notification-type.enum"

export class CreateNotificationDto {
  @IsUUID()
  userId: string

  @IsOptional()
  @IsUUID()
  templateId?: string

  @IsEnum(NotificationType)
  type: NotificationType

  @IsString()
  title: string

  @IsString()
  content: string

  @IsOptional()
  @IsObject()
  data?: Record<string, any>

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: string[]

  @IsOptional()
  @IsDateString()
  scheduledAt?: string
}
