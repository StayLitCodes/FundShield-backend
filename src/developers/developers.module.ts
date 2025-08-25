import { Module } from "@nestjs/common"
import { HttpModule } from "@nestjs/axios"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ThrottlerModule } from "@nestjs/throttler"
import { DevelopersController } from "./developers.controller"
import { DevelopersService } from "./developers.service"
import { Integration } from "./entities/integration.entity"
import { ApiIntegrationService } from "./services/api-integration.service"
import { PriceFeedService } from "./services/price-feed.service"
import { KycService } from "./services/kyc.service"
import { PaymentGatewayService } from "./services/payment-gateway.service"

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    TypeOrmModule.forFeature([Integration]),
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000,
        limit: 3,
      },
      {
        name: "medium",
        ttl: 10000,
        limit: 20,
      },
      {
        name: "long",
        ttl: 60000,
        limit: 100,
      },
    ]),
  ],
  controllers: [DevelopersController],
  providers: [DevelopersService, ApiIntegrationService, PriceFeedService, KycService, PaymentGatewayService],
  exports: [DevelopersService, ApiIntegrationService],
})
export class DevelopersModule {}
