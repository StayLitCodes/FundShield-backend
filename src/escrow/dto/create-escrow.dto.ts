import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsObject,
  IsDateString,
  ValidateNested,
  Min,
  Max,
} from "class-validator"
import { Type } from "class-transformer"
import { EscrowType } from "../enums/escrow-type.enum"

class CreateMilestoneDto {
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number

  @IsOptional()
  @IsArray()
  requirements?: Array<{
    description: string
    type: string
  }>

  @IsOptional()
  @IsDateString()
  dueDate?: string

  @IsOptional()
  @IsBoolean()
  autoApprove?: boolean

  @IsOptional()
  @IsNumber()
  @Min(0)
  autoApproveDelayHours?: number
}

class CreateConditionDto {
  @IsString()
  type: string

  @IsString()
  name: string

  @IsString()
  description: string

  @IsObject()
  parameters: Record<string, any>

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean
}

class CreateParticipantDto {
  @IsUUID()
  userId: string

  @IsString()
  role: string

  @IsOptional()
  @IsArray()
  permissions?: string[]
}

export class CreateEscrowDto {
  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(EscrowType)
  type: EscrowType

  @IsUUID()
  buyerId: string

  @IsUUID()
  sellerId: string

  @IsNumber()
  @Min(0)
  totalAmount: number

  @IsOptional()
  @IsString()
  currency?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  feePercentage?: number

  @IsOptional()
  @IsUUID()
  templateId?: string

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
  isMultiMilestone?: boolean

  @IsOptional()
  @IsBoolean()
  autoRelease?: boolean

  @IsOptional()
  @IsNumber()
  @Min(0)
  autoReleaseDelayHours?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMilestoneDto)
  milestones?: CreateMilestoneDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateConditionDto)
  conditions?: CreateConditionDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParticipantDto)
  participants?: CreateParticipantDto[]
}
