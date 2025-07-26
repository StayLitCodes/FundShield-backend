import { IsUUID, IsEnum, IsBoolean, IsOptional, IsObject } from "class-validator"
import { NotificationType } from "../enums/notification-type.enum"

export class CreateUserPreferenceDto {
  @IsUUID()
  userId: string

  @IsEnum(NotificationType)
  notificationType: NotificationType

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean

  @IsOptional()
  @IsObject()
  customSettings?: Record<string, any>
}

export class UpdateUserPreferenceDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean

  @IsOptional()
  @IsObject()
  customSettings?: Record<string, any>
}
