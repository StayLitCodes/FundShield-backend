import { IsOptional, IsString, IsDateString, IsArray, IsObject, IsNumber, Min, Max } from "class-validator"

export class AnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @IsString()
  groupBy?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[]

  @IsOptional()
  @IsObject()
  filters?: Record<string, any>

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number

  @IsOptional()
  @IsString()
  sortBy?: string

  @IsOptional()
  @IsString()
  sortOrder?: "ASC" | "DESC"
}
