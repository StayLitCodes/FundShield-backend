import { IsString, IsEnum, IsObject, IsOptional, IsUUID, IsDateString } from "class-validator"
import { ReportType } from "../enums/report-type.enum"

export class CreateReportDto {
  @IsString()
  name: string

  @IsEnum(ReportType)
  type: ReportType

  @IsObject()
  parameters: Record<string, any>

  @IsUUID()
  createdBy: string

  @IsOptional()
  @IsString()
  format?: string

  @IsOptional()
  @IsDateString()
  scheduledAt?: string
}
