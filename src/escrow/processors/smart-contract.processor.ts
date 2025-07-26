import { Process, Processor } from "@nestjs/bull"
import type { Job } from "bull"
import { Logger } from "@nestjs/common"
import type { SmartContractService } from "../services/smart-contract.service"
import type { EscrowTransactionService } from "../services/escrow-transaction.service"

@Processor("smart-contract-queue")
export class SmartContractProcessor {
  private readonly logger = new Logger(SmartContractProcessor.name)

  constructor(
    private smartContractService: SmartContractService,
    private escrowTransactionService: EscrowTransactionService,
  ) {}

  @Process("process-transaction")
  async handleProcessTransaction(job: Job) {
    const { transactionId } = job.data

    try {
      this.logger.log(`Processing blockchain transaction: ${transactionId}`)

      await this.escrowTransactionService.processTransaction(transactionId)

      this.logger.log(`Blockchain transaction processed: ${transactionId}`)
    } catch (error) {
      this.logger.error(`Failed to process blockchain transaction ${transactionId}:`, error)
      throw error
    }
  }

  @Process("verify-transaction")
  async handleVerifyTransaction(job: Job) {
    const { transactionHash } = job.data

    try {
      this.logger.log(`Verifying blockchain transaction: ${transactionHash}`)

      const status = await this.smartContractService.getTransactionStatus(transactionHash)

      if (status.status === "confirmed") {
        // Update transaction status in database
        // This would typically involve finding the transaction by hash and updating its status
        this.logger.log(`Transaction confirmed: ${transactionHash}`)
      }

      return status
    } catch (error) {
      this.logger.error(`Failed to verify transaction ${transactionHash}:`, error)
      throw error
    }
  }
}
