import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CryptoUtilsDto {
  @ApiProperty({ description: 'Data to process' })
  @IsString()
  data: string;

  @ApiProperty({ description: 'Algorithm to use', required: false })
  @IsOptional()
  @IsString()
  algorithm?: string;
}

export class SecureRandomDto {
  @ApiProperty({ description: 'Length of random data' })
  @IsNumber()
  length: number;

  @ApiProperty({ description: 'Encoding format', required: false })
  @IsOptional()
  @IsIn(['hex', 'base64', 'ascii'])
  encoding?: 'hex' | 'base64' | 'ascii';
}