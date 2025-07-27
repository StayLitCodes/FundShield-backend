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
  Min,
  Max,
} from "class-validator"
import { MilestoneStatus } from "../enums/milestone-status.enum"

export class CreateMilestoneDto {
  @IsUUID()
  escrowId: string

  @IsString()
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsNumber()
  @Min(1)
  order: number

  @IsNumber()
  @Min(0)
  amount: number

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
  @IsArray()
  deliverables?: Array<{
    name: string
    description: string
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

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}

export class UpdateMilestoneDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(MilestoneStatus)
  status?: MilestoneStatus

  @IsOptional()
  @IsArray()
  requirements?: Array<{
    id: string
    description: string
    type: string
    completed: boolean
    completedAt?: Date
    completedBy?: string
  }>

  @IsOptional()
  @IsArray()
  deliverables?: Array<{
    id: string
    name: string
    description: string
    fileUrl?: string
    submittedAt?: Date
    approved: boolean
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

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}

export class ApproveMilestoneDto {
  @IsOptional()
  @IsString()
  approvalNotes?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}

export class RejectMilestoneDto {
  @IsString()
  rejectionReason: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}
