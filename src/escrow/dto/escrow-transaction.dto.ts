import { IsString, IsUUID, IsNumber, IsOptional, IsEnum, IsObject, Min } from "class-validator"
import { TransactionType } from "../enums/transaction-type.enum"

export class CreateTransactionDto {
  @IsUUID()
  escrowId: string

  @IsOptional()
  @IsUUID()
  milestoneId?: string

  @IsEnum(TransactionType)
  type: TransactionType

  @IsNumber()
  @Min(0)
  amount: number

  @IsOptional()
  @IsString()
  currency?: string

  @IsUUID()
  initiatedBy: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  externalTransactionId?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}
