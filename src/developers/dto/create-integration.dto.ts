import { IsEnum, IsString, IsObject, IsUrl, IsNumber, IsOptional } from "class-validator"
import { IntegrationType } from "../entities/integration.entity"

export class CreateIntegrationDto {
  @IsString()
  developerId: string

  @IsEnum(IntegrationType)
  type: IntegrationType

  @IsString()
  name: string

  @IsString()
  provider: string

  @IsObject()
  config: Record<string, any>

  @IsObject()
  @IsOptional()
  credentials?: Record<string, any>

  @IsUrl()
  apiEndpoint: string

  @IsNumber()
  @IsOptional()
  rateLimit?: number
}
