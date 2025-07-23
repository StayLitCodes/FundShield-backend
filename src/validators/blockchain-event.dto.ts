import {
  IsString,
  IsNumber,
  IsEnum,
  IsObject,
  IsOptional,
  IsDateString,
  Min,
  Max,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType, EventStatus } from '../models/blockchain-event.entity';
import { Transform } from 'class-transformer';

export class CreateBlockchainEventDto {
  @ApiProperty({ description: 'Transaction hash', example: '0x123...' })
  @IsString()
  @Length(66, 66)
  transactionHash: string;

  @ApiProperty({ description: 'Block hash', example: '0x456...' })
  @IsString()
  @Length(66, 66)
  blockHash: string;

  @ApiProperty({ description: 'Block number', example: 12345 })
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  blockNumber: number;

  @ApiProperty({ description: 'Contract address', example: '0x789...' })
  @IsString()
  @Length(66, 66)
  contractAddress: string;

  @ApiProperty({ description: 'Event name', example: 'Transfer' })
  @IsString()
  eventName: string;

  @ApiProperty({ enum: EventType, description: 'Event type' })
  @IsEnum(EventType)
  eventType: EventType;

  @ApiProperty({ description: 'Raw event data' })
  @IsObject()
  eventData: Record<string, any>;

  @ApiPropertyOptional({ description: 'Decoded event data' })
  @IsOptional()
  @IsObject()
  decodedData?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateBlockchainEventDto {
  @ApiPropertyOptional({ enum: EventStatus, description: 'Event status' })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ description: 'Decoded event data' })
  @IsOptional()
  @IsObject()
  decodedData?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Error message' })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Retry count' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  retryCount?: number;

  @ApiPropertyOptional({ description: 'Processing timestamp' })
  @IsOptional()
  @IsDateString()
  processedAt?: Date;

  @ApiPropertyOptional({ description: 'Last retry timestamp' })
  @IsOptional()
  @IsDateString()
  lastRetryAt?: Date;
}

export class EventFilterDto {
  @ApiPropertyOptional({ description: 'Contract address filter' })
  @IsOptional()
  @IsString()
  contractAddress?: string;

  @ApiPropertyOptional({ enum: EventType, description: 'Event type filter' })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiPropertyOptional({ enum: EventStatus, description: 'Status filter' })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ description: 'From block number' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fromBlock?: number;

  @ApiPropertyOptional({ description: 'To block number' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  toBlock?: number;

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
