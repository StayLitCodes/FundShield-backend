import { IsString, IsNumber, IsOptional, IsObject, IsArray, IsEnum, IsUUID, IsDateString } from "class-validator"
import { MetricType } from "../enums/metric-type.enum"

export class CreateMetricDto {
  @IsEnum(MetricType)
  type: MetricType

  @IsString()
  name: string

  @IsNumber()
  value: number

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>

  @IsOptional()
  @IsUUID()
  entityId?: string

  @IsOptional()
  @IsString()
  entityType?: string

  @IsOptional()
  @IsUUID()
  userId?: string

  @IsOptional()
  @IsDateString()
  timestamp?: string

  @IsOptional()
  @IsString()
  source?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]
}
