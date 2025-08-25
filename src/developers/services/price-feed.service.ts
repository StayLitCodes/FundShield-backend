import { Injectable, Logger } from "@nestjs/common"
import type { HttpService } from "@nestjs/axios"
import { firstValueFrom, timeout } from "rxjs"
import type { Integration } from "../entities/integration.entity"

@Injectable()
export class PriceFeedService {
  private readonly logger = new Logger(PriceFeedService.name)

  constructor(private readonly httpService: HttpService) {}

  async testConnection(integration: Integration): Promise<any> {
    this.logger.log(`Testing price feed connection: ${integration.name}`)

    const testSymbol = integration.config.symbols?.[0] || "BTC"
    const endpoint = this.buildPriceEndpoint(integration, testSymbol)

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
        testSymbol,
        price: this.extractPrice(response.data, integration.provider),
        timestamp: new Date(),
      }
    } catch (error) {
      throw new Error(`Price feed test failed: ${error.message}`)
    }
  }

  async getPrice(integration: Integration, symbol: string): Promise<number> {
    const endpoint = this.buildPriceEndpoint(integration, symbol)

    const response = await firstValueFrom(
      this.httpService
        .get(endpoint, {
          headers: this.buildHeaders(integration),
        })
        .pipe(timeout(10000)),
    )

    return this.extractPrice(response.data, integration.provider)
  }

  private buildPriceEndpoint(integration: Integration, symbol: string): string {
    const baseUrl = integration.apiEndpoint

    switch (integration.provider.toLowerCase()) {
      case "coinbase":
        return `${baseUrl}/exchange-rates?currency=${symbol}`
      case "binance":
        return `${baseUrl}/api/v3/ticker/price?symbol=${symbol}USDT`
      case "coingecko":
        return `${baseUrl}/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`
      default:
        return `${baseUrl}/price/${symbol}`
    }
  }

  private extractPrice(data: any, provider: string): number {
    switch (provider.toLowerCase()) {
      case "coinbase":
        return Number.parseFloat(data.data?.rates?.USD || "0")
      case "binance":
        return Number.parseFloat(data.price || "0")
      case "coingecko":
        return Number.parseFloat(Object.values(data)[0]?.usd || "0")
      default:
        return Number.parseFloat(data.price || data.value || "0")
    }
  }

  private buildHeaders(integration: Integration): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (integration.credentials?.apiKey) {
      headers["X-API-Key"] = integration.credentials.apiKey
    }

    return headers
  }
}
