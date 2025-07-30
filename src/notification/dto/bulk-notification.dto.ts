import { IsArray, IsEnum, IsString, IsOptional, IsObject, ValidateNested } from "class-validator"
import { Type } from "class-transformer"
import { NotificationType } from "../enums/notification-type.enum"

class BulkRecipient {
  @IsString()
  userId: string

  @IsOptional()
  @IsObject()
  personalizedData?: Record<string, any>
}

export class BulkNotificationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkRecipient)
  recipients: BulkRecipient[]

  @IsOptional()
  @IsString()
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
}
