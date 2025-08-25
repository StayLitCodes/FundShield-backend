import { IsString, IsOptional } from 'class-validator';

export class UpdateConfigurationDto {
  @IsString()
  @IsOptional()
  key?: string;

  @IsString()
  @IsOptional()
  value?: string;
}
