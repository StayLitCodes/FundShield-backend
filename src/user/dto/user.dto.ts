import { IsString, IsEmail, IsOptional, IsEnum, IsBoolean, IsArray, ValidateNested, IsObject, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { KycStatus } from '../entities/user-kyc.entity';

export class RegisterUserDto {
  @IsString()
  @MaxLength(30)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  profilePictureUrl?: string;
}

export class KycDocumentDto {
  @IsString()
  type: string;

  @IsString()
  url: string;
}

export class SubmitKycDto {
  @IsEnum(KycStatus)
  status: KycStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KycDocumentDto)
  documents: KycDocumentDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePreferenceDto {
  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;

  @IsOptional()
  @IsObject()
  privacy?: {
    showProfile?: boolean;
    showActivity?: boolean;
    emailNotifications?: boolean;
    [key: string]: any;
  };
}

export class UserSearchFilterDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsEnum(KycStatus)
  kycStatus?: KycStatus;

  @IsOptional()
  @IsBoolean()
  isSuspended?: boolean;

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
} 