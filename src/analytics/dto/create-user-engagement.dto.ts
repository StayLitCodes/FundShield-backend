import { IsString, IsNumber, IsOptional, IsObject, IsEnum, IsUUID, IsDateString } from "class-validator"
import { EngagementType } from "../enums/engagement-type.enum"

export class CreateUserEngagementDto {
  @IsUUID()
  userId: string

  @IsEnum(EngagementType)
  type: EngagementType

  @IsString()
  action: string

  @IsOptional()
  @IsString()
  page?: string

  @IsOptional()
  @IsString()
  feature?: string

  @IsOptional()
  @IsNumber()
  duration?: number

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>

  @IsOptional()
  @IsDateString()
  timestamp?: string

  @IsOptional()
  @IsString()
  sessionId?: string

  @IsOptional()
  @IsString()
  userAgent?: string

  @IsOptional()
  @IsString()
  ipAddress?: string
}
