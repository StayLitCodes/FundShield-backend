import { Injectable, Logger } from "@nestjs/common"
import type { HttpService } from "@nestjs/axios"
import { firstValueFrom, timeout, retry, catchError } from "rxjs"
import { type Integration, IntegrationType } from "../entities/integration.entity"
import type { PriceFeedService } from "./price-feed.service"
import type { KycService } from "./kyc.service"
import type { PaymentGatewayService } from "./payment-gateway.service"

@Injectable()
export class ApiIntegrationService {
  private readonly logger = new Logger(ApiIntegrationService.name)

  constructor(
    private readonly httpService: HttpService,
    private readonly priceFeedService: PriceFeedService,
    private readonly kycService: KycService,
    private readonly paymentGatewayService: PaymentGatewayService,
  ) {}

  async testConnection(integration: Integration): Promise<any> {
    this.logger.log(`Testing connection for integration: ${integration.name}`)

    try {
      switch (integration.type) {
        case IntegrationType.PRICE_FEED:
          return await this.priceFeedService.testConnection(integration)
        case IntegrationType.KYC_PROVIDER:
          return await this.kycService.testConnection(integration)
        case IntegrationType.PAYMENT_GATEWAY:
          return await this.paymentGatewayService.testConnection(integration)
        default:
          return await this.genericTestConnection(integration)
      }
    } catch (error) {
      this.logger.error(`Connection test failed for ${integration.name}: ${error.message}`)
      throw error
    }
  }

  async makeApiCall(integration: Integration, endpoint: string, data?: any): Promise<any> {
    const url = `${integration.apiEndpoint}${endpoint}`
    const headers = this.buildHeaders(integration)

    try {
      const response = await firstValueFrom(
        this.httpService
          .request({
            method: data ? "POST" : "GET",
            url,
            headers,
            data,
            timeout: 10000,
          })
          .pipe(
            timeout(15000),
            retry(2),
            catchError((error) => {
              this.logger.error(`API call failed: ${error.message}`)
              throw error
            }),
          ),
      )

      return response.data
    } catch (error) {
      this.logger.error(`API call to ${url} failed: ${error.message}`)
      throw new Error(`API call failed: ${error.message}`)
    }
  }

  private async genericTestConnection(integration: Integration): Promise<any> {
    const headers = this.buildHeaders(integration)

    const response = await firstValueFrom(
      this.httpService.get(integration.apiEndpoint, { headers }).pipe(timeout(10000), retry(1)),
    )

    return {
      status: "connected",
      responseTime: Date.now(),
      statusCode: response.status,
    }
  }

  private buildHeaders(integration: Integration): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "NestJS-Developers-Module/1.0",
    }

    if (integration.credentials) {
      if (integration.credentials.apiKey) {
        headers["Authorization"] = `Bearer ${integration.credentials.apiKey}`
      }
      if (integration.credentials.customHeaders) {
        Object.assign(headers, integration.credentials.customHeaders)
      }
    }

    return headers
  }
}
