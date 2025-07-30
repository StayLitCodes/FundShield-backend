import { Process, Processor } from "@nestjs/bull"
import type { Job } from "bull"
import { Logger } from "@nestjs/common"
import type { EscrowService } from "../services/escrow.service"
import type { MilestoneService } from "../services/milestone.service"
import type { SmartContractService } from "../services/smart-contract.service"
import type { EscrowTransactionService } from "../services/escrow-transaction.service"

@Processor("escrow-queue")
export class EscrowProcessor {
  private readonly logger = new Logger(EscrowProcessor.name)

  constructor(
    private escrowService: EscrowService,
    private milestoneService: MilestoneService,
    private smartContractService: SmartContractService,
    private escrowTransactionService: EscrowTransactionService,
  ) {}

  @Process("deploy-smart-contract")
  async handleDeploySmartContract(job: Job) {
    const { escrowId } = job.data

    try {
      this.logger.log(`Deploying smart contract for escrow: ${escrowId}`)

      const escrow = await this.escrowService.getEscrowById(escrowId)

      const contractData = await this.smartContractService.deployEscrowContract({
        escrowId: escrow.id,
        buyerId: escrow.buyerId,
        sellerId: escrow.sellerId,
        amount: escrow.totalAmount,
        currency: escrow.currency,
        terms: escrow.terms || {},
      })

      // Update escrow with contract information
      await this.escrowService.updateEscrow(
        escrowId,
        {
          metadata: {
            ...escrow.metadata,
            smartContractAddress: contractData.contractAddress,
            blockchainTxHash: contractData.transactionHash,
            smartContractData: contractData.deploymentData,
          },
        },
        "system",
      )

      this.logger.log(`Smart contract deployed for escrow ${escrowId}: ${contractData.contractAddress}`)
    } catch (error) {
      this.logger.error(`Failed to deploy smart contract for escrow ${escrowId}:`, error)
      throw error
    }
  }

  @Process("create-milestones")
  async handleCreateMilestones(job: Job) {
    const { escrowId, milestones } = job.data

    try {
      this.logger.log(`Creating milestones for escrow: ${escrowId}`)

      for (let i = 0; i < milestones.length; i++) {
        const milestoneData = {
          ...milestones[i],
          escrowId,
          order: i + 1,
        }

        await this.milestoneService.createMilestone(milestoneData, "system")
      }

      this.logger.log(`Created ${milestones.length} milestones for escrow ${escrowId}`)
    } catch (error) {
      this.logger.error(`Failed to create milestones for escrow ${escrowId}:`, error)
      throw error
    }
  }

  @Process("create-transaction")
  async handleCreateTransaction(job: Job) {
    const transactionData = job.data

    try {
      this.logger.log(`Creating transaction for escrow: ${transactionData.escrowId}`)

      const transaction = await this.escrowTransactionService.createTransaction(transactionData)
      await this.escrowTransactionService.processTransaction(transaction.id)

      this.logger.log(`Transaction created and processed: ${transaction.id}`)
    } catch (error) {
      this.logger.error(`Failed to create transaction:`, error)
      throw error
    }
  }

  @Process("start-first-milestone")
  async handleStartFirstMilestone(job: Job) {
    const { escrowId } = job.data

    try {
      this.logger.log(`Starting first milestone for escrow: ${escrowId}`)

      const milestones = await this.milestoneService.getEscrowMilestones(escrowId)
      const firstMilestone = milestones.find((m) => m.order === 1)

      if (firstMilestone) {
        await this.milestoneService.startMilestone(firstMilestone.id, "system")
        this.logger.log(`First milestone started for escrow ${escrowId}`)
      }
    } catch (error) {
      this.logger.error(`Failed to start first milestone for escrow ${escrowId}:`, error)
      throw error
    }
  }

  @Process("complete-escrow")
  async handleCompleteEscrow(job: Job) {
    const { escrowId } = job.data

    try {
      this.logger.log(`Completing escrow: ${escrowId}`)

      const escrow = await this.escrowService.getEscrowById(escrowId)

      // Release any remaining funds
      if (escrow.lockedAmount > 0) {
        await this.escrowService.releaseEscrowFunds(escrowId, "system")
      }

      this.logger.log(`Escrow completed: ${escrowId}`)
    } catch (error) {
      this.logger.error(`Failed to complete escrow ${escrowId}:`, error)
      throw error
    }
  }

  @Process("bulk-create-escrows")
  async handleBulkCreateEscrows(job: Job) {
    const { escrows, globalSettings, createdBy } = job.data

    try {
      this.logger.log(`Bulk creating ${escrows.length} escrows`)

      const results = []
      for (const escrowData of escrows) {
        try {
          // Apply global settings
          const finalEscrowData = {
            ...escrowData,
            ...globalSettings,
          }

          const escrow = await this.escrowService.createEscrow(finalEscrowData, createdBy)
          results.push({ success: true, escrowId: escrow.id, escrowNumber: escrow.escrowNumber })
        } catch (error) {
          results.push({ success: false, error: error.message, data: escrowData })
        }
      }

      this.logger.log(
        `Bulk escrow creation completed: ${results.filter((r) => r.success).length} successful, ${results.filter((r) => !r.success).length} failed`,
      )

      // Store results for later retrieval
      job.progress(100)
      return results
    } catch (error) {
      this.logger.error("Bulk escrow creation failed:", error)
      throw error
    }
  }

  @Process("bulk-update-escrows")
  async handleBulkUpdateEscrows(job: Job) {
    const { escrowIds, updates, updatedBy } = job.data

    try {
      this.logger.log(`Bulk updating ${escrowIds.length} escrows`)

      const results = []
      for (const escrowId of escrowIds) {
        try {
          const escrow = await this.escrowService.updateEscrow(escrowId, updates, updatedBy)
          results.push({ success: true, escrowId: escrow.id, escrowNumber: escrow.escrowNumber })
        } catch (error) {
          results.push({ success: false, error: error.message, escrowId })
        }
      }

      this.logger.log(
        `Bulk escrow update completed: ${results.filter((r) => r.success).length} successful, ${results.filter((r) => !r.success).length} failed`,
      )

      job.progress(100)
      return results
    } catch (error) {
      this.logger.error("Bulk escrow update failed:", error)
      throw error
    }
  }
}
