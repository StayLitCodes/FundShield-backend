import { IsOptional, IsString, IsEnum, IsDateString, IsArray, IsNumber, Min, Max } from "class-validator"
import { EscrowStatus } from "../enums/escrow-status.enum"
import { EscrowType } from "../enums/escrow-type.enum"

export class EscrowQueryDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsEnum(EscrowStatus)
  status?: EscrowStatus

  @IsOptional()
  @IsEnum(EscrowType)
  type?: EscrowType

  @IsOptional()
  @IsString()
  buyerId?: string

  @IsOptional()
  @IsString()
  sellerId?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmount?: number

  @IsOptional()
  @IsString()
  currency?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
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
