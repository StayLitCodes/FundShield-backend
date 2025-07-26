import { IsArray, ValidateNested, IsOptional, IsObject } from "class-validator"
import { Type } from "class-transformer"
import { CreateEscrowDto } from "./create-escrow.dto"

export class BulkCreateEscrowDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEscrowDto)
  escrows: CreateEscrowDto[]

  @IsOptional()
  @IsObject()
  globalSettings?: {
    templateId?: string
    feePercentage?: number
    autoRelease?: boolean
    autoReleaseDelayHours?: number
  }
}

export class BulkUpdateEscrowDto {
  @IsArray()
  escrowIds: string[]

  @IsObject()
  updates: {
    status?: string
    autoRelease?: boolean
    autoReleaseDelayHours?: number
    metadata?: Record<string, any>
  }
}
