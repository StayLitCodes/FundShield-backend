import { Controller, Post, Get, Param } from "@nestjs/common"
import type { BulkEscrowService } from "../services/bulk-escrow.service"
import type { BulkCreateEscrowDto, BulkUpdateEscrowDto } from "../dto/bulk-escrow.dto"

@Controller("bulk-escrows")
export class BulkEscrowController {
  constructor(private readonly bulkEscrowService: BulkEscrowService) {}

  @Post("create")
  async bulkCreateEscrows(bulkCreateDto: BulkCreateEscrowDto, createdBy: string) {
    return this.bulkEscrowService.bulkCreateEscrows(bulkCreateDto, createdBy)
  }

  @Post("update")
  async bulkUpdateEscrows(bulkUpdateDto: BulkUpdateEscrowDto, updatedBy: string) {
    return this.bulkEscrowService.bulkUpdateEscrows(bulkUpdateDto, updatedBy)
  }

  @Get("status/:jobId")
  async getBulkOperationStatus(@Param("jobId") jobId: string) {
    return this.bulkEscrowService.getBulkOperationStatus(jobId)
  }
}
