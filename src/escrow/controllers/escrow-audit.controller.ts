import { Controller, Get, Query } from "@nestjs/common"
import type { EscrowAuditService } from "../services/escrow-audit.service"

@Controller("escrow-audit")
export class EscrowAuditController {
  constructor(private readonly escrowAuditService: EscrowAuditService) {}

  @Get("escrow/:escrowId")
  async getEscrowHistory(escrowId: string) {
    return this.escrowAuditService.getEscrowHistory(escrowId)
  }

  @Get("user/:userId")
  async getUserAuditHistory(userId: string, @Query("limit") limit = 100) {
    return this.escrowAuditService.getUserAuditHistory(userId, limit)
  }

  @Get("statistics")
  async getAuditStatistics(@Query("escrowId") escrowId?: string) {
    return this.escrowAuditService.getAuditStatistics(escrowId)
  }
}
