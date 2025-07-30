import { IsString, IsOptional, IsObject, IsDateString, IsBoolean, IsNumber, Min } from "class-validator"

export class UpdateEscrowDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsObject()
  terms?: Record<string, any>

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>

  @IsOptional()
  @IsDateString()
  fundingDeadline?: string

  @IsOptional()
  @IsDateString()
  completionDeadline?: string

  @IsOptional()
  @IsBoolean()
  autoRelease?: boolean

  @IsOptional()
  @IsNumber()
  @Min(0)
  autoReleaseDelayHours?: number
}
