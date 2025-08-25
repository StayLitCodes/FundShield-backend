import { Controller, Get, Post, Patch, Param, Delete, Query, UseGuards, HttpStatus, HttpCode } from "@nestjs/common"
import { Throttle, ThrottlerGuard } from "@nestjs/throttler"
import type { DevelopersService } from "./developers.service"
import type { CreateIntegrationDto } from "./dto/create-integration.dto"
import type { UpdateIntegrationDto } from "./dto/update-integration.dto"
import { ApiResponseDto } from "./dto/api-response.dto"
import type { IntegrationType } from "./entities/integration.entity"

@Controller("developers/integrations")
@UseGuards(ThrottlerGuard)
export class DevelopersController {
  constructor(private readonly developersService: DevelopersService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async create(createIntegrationDto: CreateIntegrationDto) {
    try {
      const integration = await this.developersService.create(createIntegrationDto)
      return new ApiResponseDto(true, integration)
    } catch (error) {
      return new ApiResponseDto(false, null, error.message)
    }
  }

  @Get()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async findAll(
    @Query('developerId') developerId?: string,
    @Query('type') type?: IntegrationType,
    @Query('status') status?: string,
  ) {
    try {
      const integrations = await this.developersService.findAll({
        developerId,
        type,
        status,
      })
      return new ApiResponseDto(true, integrations)
    } catch (error) {
      return new ApiResponseDto(false, null, error.message)
    }
  }

  @Get(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async findOne(@Param('id') id: string) {
    try {
      const integration = await this.developersService.findOne(id);
      return new ApiResponseDto(true, integration);
    } catch (error) {
      return new ApiResponseDto(false, null, error.message);
    }
  }

  @Patch(":id")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async update(@Param('id') id: string, updateIntegrationDto: UpdateIntegrationDto) {
    try {
      const integration = await this.developersService.update(id, updateIntegrationDto)
      return new ApiResponseDto(true, integration)
    } catch (error) {
      return new ApiResponseDto(false, null, error.message)
    }
  }

  @Delete(':id')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    try {
      await this.developersService.remove(id);
      return new ApiResponseDto(true);
    } catch (error) {
      return new ApiResponseDto(false, null, error.message);
    }
  }

  @Post(':id/test')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async testIntegration(@Param('id') id: string) {
    try {
      const result = await this.developersService.testIntegration(id);
      return new ApiResponseDto(true, result);
    } catch (error) {
      return new ApiResponseDto(false, null, error.message);
    }
  }

  @Get(':id/health')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async checkHealth(@Param('id') id: string) {
    try {
      const health = await this.developersService.checkIntegrationHealth(id);
      return new ApiResponseDto(true, health);
    } catch (error) {
      return new ApiResponseDto(false, null, error.message);
    }
  }
}
