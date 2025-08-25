import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common"
import type { Repository } from "typeorm"
import { type Integration, IntegrationType, IntegrationStatus } from "./entities/integration.entity"
import type { CreateIntegrationDto } from "./dto/create-integration.dto"
import type { UpdateIntegrationDto } from "./dto/update-integration.dto"
import type { ApiIntegrationService } from "./services/api-integration.service"

@Injectable()
export class DevelopersService {
  private integrationRepository: Repository<Integration>
  private apiIntegrationService: ApiIntegrationService

  constructor(integrationRepository: Repository<Integration>, apiIntegrationService: ApiIntegrationService) {
    this.integrationRepository = integrationRepository
    this.apiIntegrationService = apiIntegrationService
  }

  async create(createIntegrationDto: CreateIntegrationDto): Promise<Integration> {
    try {
      // Validate integration configuration
      await this.validateIntegrationConfig(createIntegrationDto)

      const integration = this.integrationRepository.create(createIntegrationDto)
      const savedIntegration = await this.integrationRepository.save(integration)

      // Test the integration after creation
      try {
        await this.testIntegration(savedIntegration.id)
        savedIntegration.status = IntegrationStatus.ACTIVE
      } catch (error) {
        savedIntegration.status = IntegrationStatus.ERROR
        savedIntegration.lastError = error.message
      }

      return await this.integrationRepository.save(savedIntegration)
    } catch (error) {
      throw new BadRequestException(`Failed to create integration: ${error.message}`)
    }
  }

  async findAll(filters: {
    developerId?: string
    type?: IntegrationType
    status?: string
  }): Promise<Integration[]> {
    const query = this.integrationRepository.createQueryBuilder("integration")

    if (filters.developerId) {
      query.andWhere("integration.developerId = :developerId", {
        developerId: filters.developerId,
      })
    }

    if (filters.type) {
      query.andWhere("integration.type = :type", { type: filters.type })
    }

    if (filters.status) {
      query.andWhere("integration.status = :status", { status: filters.status })
    }

    return await query.orderBy("integration.createdAt", "DESC").getMany()
  }

  async findOne(id: string): Promise<Integration> {
    const integration = await this.integrationRepository.findOne({ where: { id } })
    if (!integration) {
      throw new NotFoundException(`Integration with ID ${id} not found`)
    }
    return integration
  }

  async update(id: string, updateIntegrationDto: UpdateIntegrationDto): Promise<Integration> {
    const integration = await this.findOne(id)

    if (updateIntegrationDto.config || updateIntegrationDto.apiEndpoint) {
      await this.validateIntegrationConfig({
        ...integration,
        ...updateIntegrationDto,
      } as CreateIntegrationDto)
    }

    Object.assign(integration, updateIntegrationDto)
    return await this.integrationRepository.save(integration)
  }

  async remove(id: string): Promise<void> {
    const integration = await this.findOne(id)
    await this.integrationRepository.remove(integration)
  }

  async testIntegration(id: string): Promise<any> {
    const integration = await this.findOne(id)

    try {
      const result = await this.apiIntegrationService.testConnection(integration)

      // Update last used timestamp
      integration.lastUsed = new Date()
      integration.errorCount = 0
      integration.lastError = null
      await this.integrationRepository.save(integration)

      return result
    } catch (error) {
      // Update error information
      integration.errorCount += 1
      integration.lastError = error.message
      integration.status = IntegrationStatus.ERROR
      await this.integrationRepository.save(integration)

      throw error
    }
  }

  async checkIntegrationHealth(id: string): Promise<any> {
    const integration = await this.findOne(id)

    return {
      id: integration.id,
      name: integration.name,
      status: integration.status,
      lastUsed: integration.lastUsed,
      errorCount: integration.errorCount,
      lastError: integration.lastError,
      uptime: this.calculateUptime(integration),
    }
  }

  private async validateIntegrationConfig(dto: CreateIntegrationDto): Promise<void> {
    // Basic validation
    if (!dto.apiEndpoint || !dto.config) {
      throw new BadRequestException("API endpoint and config are required")
    }

    // Type-specific validation
    switch (dto.type) {
      case IntegrationType.PRICE_FEED:
        this.validatePriceFeedConfig(dto.config)
        break
      case IntegrationType.KYC_PROVIDER:
        this.validateKycConfig(dto.config)
        break
      case IntegrationType.PAYMENT_GATEWAY:
        this.validatePaymentGatewayConfig(dto.config)
        break
    }
  }

  private validatePriceFeedConfig(config: any): void {
    if (!config.symbols || !Array.isArray(config.symbols)) {
      throw new BadRequestException("Price feed config must include symbols array")
    }
  }

  private validateKycConfig(config: any): void {
    if (!config.verificationLevels || !Array.isArray(config.verificationLevels)) {
      throw new BadRequestException("KYC config must include verification levels")
    }
  }

  private validatePaymentGatewayConfig(config: any): void {
    if (!config.supportedCurrencies || !Array.isArray(config.supportedCurrencies)) {
      throw new BadRequestException("Payment gateway config must include supported currencies")
    }
  }

  private calculateUptime(integration: Integration): number {
    const totalTime = Date.now() - integration.createdAt.getTime()
    const errorTime = integration.errorCount * 60000 // Assume 1 minute downtime per error
    return Math.max(0, ((totalTime - errorTime) / totalTime) * 100)
  }
}
