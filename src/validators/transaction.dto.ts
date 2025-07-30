import {
  IsString,
  IsNumber,
  IsEnum,
  IsObject,
  IsOptional,
  IsUUID,
  IsEthereumAddress,
  Min,
  Max,
  Length,
  IsDecimal,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TransactionType,
  TransactionStatus,
} from '../models/transaction.entity';
import { Transform } from 'class-transformer';

export class CreateTransactionDto {
  @ApiProperty({ description: 'User ID', example: 'user-uuid-123' })
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: TransactionType, description: 'Transaction type' })
  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @ApiProperty({ description: 'Transaction amount', example: '1000.50' })
  @IsDecimal({ decimal_digits: '0,18' })
  amount: string;

  @ApiPropertyOptional({ description: 'Token contract address' })
  @IsOptional()
  @IsEthereumAddress()
  tokenAddress?: string;

  @ApiPropertyOptional({ description: 'From address' })
  @IsOptional()
  @IsEthereumAddress()
  fromAddress?: string;

  @ApiPropertyOptional({ description: 'To address' })
  @IsOptional()
  @IsEthereumAddress()
  toAddress?: string;

  @ApiProperty({ description: 'Idempotency key for duplicate prevention' })
  @IsString()
  @Length(1, 255)
  idempotencyKey: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Transaction expiration time' })
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;
}

export class UpdateTransactionDto {
  @ApiPropertyOptional({
    enum: TransactionStatus,
    description: 'Transaction status',
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({ description: 'Transaction hash' })
  @IsOptional()
  @IsString()
  @Length(66, 66)
  transactionHash?: string;

  @ApiPropertyOptional({ description: 'Block number' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  blockNumber?: number;

  @ApiPropertyOptional({ description: 'Gas fee' })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,18' })
  gasFee?: string;

  @ApiPropertyOptional({ description: 'Error message' })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Processing timestamp' })
  @IsOptional()
  @IsDateString()
  processedAt?: Date;
}

export class TransactionFilterDto {
  @ApiPropertyOptional({ description: 'User ID filter' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    enum: TransactionType,
    description: 'Transaction type filter',
  })
  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @ApiPropertyOptional({
    enum: TransactionStatus,
    description: 'Status filter',
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({ description: 'From date' })
  @IsOptional()
  @IsDateString()
  fromDate?: Date;

  @ApiPropertyOptional({ description: 'To date' })
  @IsOptional()
  @IsDateString()
  toDate?: Date;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SagaStepDto {
  @ApiProperty({ description: 'Step name' })
  @IsString()
  stepName: string;

  @ApiProperty({ description: 'Step order' })
  @IsNumber()
  @Min(0)
  stepOrder: number;

  @ApiPropertyOptional({ description: 'Step data' })
  @IsOptional()
  @IsObject()
  stepData?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Compensation data' })
  @IsOptional()
  @IsObject()
  compensationData?: Record<string, any>;
}
