import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSignatureDto {
  @ApiProperty({ description: 'Data to sign' })
  @IsString()
  data: string;

  @ApiProperty({ description: 'Private key for signing' })
  @IsString()
  privateKey: string;

  @ApiProperty({ description: 'Signature algorithm', required: false })
  @IsOptional()
  @IsString()
  algorithm?: string;
}

export class VerifySignatureDto {
  @ApiProperty({ description: 'Original data' })
  @IsString()
  data: string;

  @ApiProperty({ description: 'Signature to verify' })
  @IsString()
  signature: string;

  @ApiProperty({ description: 'Public key for verification' })
  @IsString()
  publicKey: string;

  @ApiProperty({ description: 'Signature algorithm', required: false })
  @IsOptional()
  @IsString()
  algorithm?: string;
}

export class KeyPairDto {
  @ApiProperty({ description: 'Public key' })
  publicKey: string;

  @ApiProperty({ description: 'Private key' })
  privateKey: string;

  @ApiProperty({ description: 'Algorithm used' })
  algorithm: string;

  @ApiProperty({ description: 'Key size', required: false })
  keySize?: number;

  @ApiProperty({ description: 'Curve name for ECDSA', required: false })
  curve?: string;
}