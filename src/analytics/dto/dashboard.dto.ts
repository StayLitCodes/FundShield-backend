import { IsString, IsOptional, IsArray, IsObject, IsBoolean, IsUUID } from "class-validator"

class WidgetDto {
  @IsString()
  id: string

  @IsString()
  type: string

  @IsString()
  title: string

  @IsObject()
  config: Record<string, any>

  @IsObject()
  position: { x: number; y: number; width: number; height: number }
}

export class CreateDashboardDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsArray()
  widgets: WidgetDto[]

  @IsOptional()
  @IsObject()
  filters?: Record<string, any>

  @IsUUID()
  createdBy: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean
}

export class UpdateDashboardDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  widgets?: WidgetDto[]

  @IsOptional()
  @IsObject()
  filters?: Record<string, any>

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean
}
