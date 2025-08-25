import { Injectable, Logger } from "@nestjs/common"
import type { HttpService } from "@nestjs/axios"
import { firstValueFrom, timeout } from "rxjs"
import type { Integration } from "../entities/integration.entity"

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name)

  constructor(private readonly httpService: HttpService) {}

  async testConnection(integration: Integration): Promise<any> {
    this.logger.log(`Testing payment gateway connection: ${integration.name}`)

    const endpoint = `${integration.apiEndpoint}/status`

    try {
      const response = await firstValueFrom(
        this.httpService
          .get(endpoint, {
            headers: this.buildHeaders(integration),
          })
          .pipe(timeout(10000)),
      )

      return {
        status: "connected",
        provider: integration.provider,
        supportedCurrencies: integration.config.supportedCurrencies,
        timestamp: new Date(),
      }
    } catch (error) {
      throw new Error(`Payment gateway test failed: ${error.message}`)
    }
  }

  async processPayment(integration: Integration, paymentData: any): Promise<any> {
    const endpoint = `${integration.apiEndpoint}/payments`

    const response = await firstValueFrom(
      this.httpService
        .post(endpoint, paymentData, {
          headers: this.buildHeaders(integration),
        })
        .pipe(timeout(30000)),
    )

    return response.data
  }

  private buildHeaders(integration: Integration): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (integration.credentials?.apiKey) {
      headers["Authorization"] = `Bearer ${integration.credentials.apiKey}`
    }

    if (integration.credentials?.secretKey) {
      headers["X-Secret-Key"] = integration.credentials.secretKey
    }

    return headers
  }
}
