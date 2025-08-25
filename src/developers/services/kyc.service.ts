import { Injectable, Logger } from "@nestjs/common"
import type { HttpService } from "@nestjs/axios"
import { firstValueFrom, timeout } from "rxjs"
import type { Integration } from "../entities/integration.entity"

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name)

  constructor(private readonly httpService: HttpService) {}

  async testConnection(integration: Integration): Promise<any> {
    this.logger.log(`Testing KYC connection: ${integration.name}`)

    const endpoint = `${integration.apiEndpoint}/health`

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
        verificationLevels: integration.config.verificationLevels,
        timestamp: new Date(),
      }
    } catch (error) {
      throw new Error(`KYC test failed: ${error.message}`)
    }
  }

  async verifyIdentity(integration: Integration, userData: any): Promise<any> {
    const endpoint = `${integration.apiEndpoint}/verify`

    const response = await firstValueFrom(
      this.httpService
        .post(endpoint, userData, {
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

    return headers
  }
}
