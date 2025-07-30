import { IsArray, ValidateNested } from "class-validator"
import { Type } from "class-transformer"
import { CreateMetricDto } from "./create-metric.dto"

export class BulkMetricsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMetricDto)
  metrics: CreateMetricDto[]
}
