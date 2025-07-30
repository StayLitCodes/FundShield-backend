import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bull"
import type { BulkCreateEscrowDto, BulkUpdateEscrowDto } from "../dto/bulk-escrow.dto"
import type { EscrowService } from "./escrow.service"

@Injectable()
export class BulkEscrowService {
  private readonly logger = new Logger(BulkEscrowService.name)

  constructor(
    private escrowService: EscrowService,
    private escrowQueue: Queue,
  ) {}

  async bulkCreateEscrows(
    bulkCreateDto: BulkCreateEscrowDto,
    createdBy: string,
  ): Promise<{
    jobId: string
    totalEscrows: number
  }> {
    const job = await this.escrowQueue.add("bulk-create-escrows", {
      escrows: bulkCreateDto.escrows,
      globalSettings: bulkCreateDto.globalSettings,
      createdBy,
    })

    this.logger.log(`Bulk escrow creation job queued: ${job.id}, ${bulkCreateDto.escrows.length} escrows`)

    return {
      jobId: job.id.toString(),
      totalEscrows: bulkCreateDto.escrows.length,
    }
  }

  async bulkUpdateEscrows(
    bulkUpdateDto: BulkUpdateEscrowDto,
    updatedBy: string,
  ): Promise<{
    jobId: string
    totalEscrows: number
  }> {
    const job = await this.escrowQueue.add("bulk-update-escrows", {
      escrowIds: bulkUpdateDto.escrowIds,
      updates: bulkUpdateDto.updates,
      updatedBy,
    })

    this.logger.log(`Bulk escrow update job queued: ${job.id}, ${bulkUpdateDto.escrowIds.length} escrows`)

    return {
      jobId: job.id.toString(),
      totalEscrows: bulkUpdateDto.escrowIds.length,
    }
  }

  async getBulkOperationStatus(jobId: string): Promise<{
    status: string
    progress: number
    completed: number
    failed: number
    errors: string[]
  }> {
    // This would typically query the job status from the queue
    // For now, returning a mock response
    return {
      status: "completed",
      progress: 100,
      completed: 10,
      failed: 0,
      errors: [],
    }
  }
}
