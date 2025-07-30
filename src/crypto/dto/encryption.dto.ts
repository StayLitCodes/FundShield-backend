import { IsString, IsOptional, IsBuffer } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EncryptDataDto {
  @ApiProperty({ description: 'Data to encrypt' })
  @IsString()
  data: string;

  @ApiProperty({ description: 'Encryption key', required: false })
  @IsOptional()
  key?: Buffer;

  @ApiProperty({ description: 'Encryption algorithm', required: false })
  @IsOptional()
  @IsString()
  algorithm?: string;

  @ApiProperty({ description: 'Additional authenticated data', required: false })
  @IsOptional()
  @IsString()
  additionalData?: string;
}

export class DecryptDataDto {
  @ApiProperty({ description: 'Encrypted data' })
  @IsString()
  encryptedData: string;

  @ApiProperty({ description: 'Encryption key' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'Initialization vector' })
  @IsString()
  iv: string;

  @ApiProperty({ description: 'Authentication tag' })
  @IsString()
  authTag: string;

  @ApiProperty({ description: 'Encryption algorithm', required: false })
  @IsOptional()
  @IsString()
  algorithm?: string;

  @ApiProperty({ description: 'Additional authenticated data', required: false })
  @IsOptional()
  @IsString()
  additionalData?: string;
}

export class EncryptedDataDto {
  @ApiProperty({ description: 'Encrypted data' })
  encryptedData: string;

  @ApiProperty({ description: 'Encryption key' })
  key: string;

  @ApiProperty({ description: 'Initialization vector' })
  iv: string;

  @ApiProperty({ description: 'Authentication tag' })
  authTag: string;

  @ApiProperty({ description: 'Algorithm used' })
  algorithm: string;
}