import { Process, Processor } from "@nestjs/bull"
import type { Job } from "bull"
import { Logger } from "@nestjs/common"
import type { MilestoneService } from "../services/milestone.service"
import type { EscrowTransactionService } from "../services/escrow-transaction.service"

@Processor("milestone-queue")
export class MilestoneProcessor {
  private readonly logger = new Logger(MilestoneProcessor.name)

  constructor(
    private milestoneService: MilestoneService,
    private escrowTransactionService: EscrowTransactionService,
  ) {}

  @Process("auto-approve-milestone")
  async handleAutoApproveMilestone(job: Job) {
    const { milestoneId } = job.data

    try {
      this.logger.log(`Auto-approving milestone: ${milestoneId}`)

      const milestone = await this.milestoneService.getMilestoneById(milestoneId)

      // Check if milestone is still in submitted status
      if (milestone.status === "submitted") {
        await this.milestoneService.approveMilestone(
          milestoneId,
          {
            approvalNotes: "Auto-approved after delay period",
          },
          "system",
        )

        this.logger.log(`Milestone auto-approved: ${milestoneId}`)
      }
    } catch (error) {
      this.logger.error(`Failed to auto-approve milestone ${milestoneId}:`, error)
      throw error
    }
  }

  @Process("release-milestone-funds")
  async handleReleaseMilestoneFunds(job: Job) {
    const { milestoneId, amount, releasedBy } = job.data

    try {
      this.logger.log(`Releasing funds for milestone: ${milestoneId}, amount: ${amount}`)

      const milestone = await this.milestoneService.getMilestoneById(milestoneId)

      // Create release transaction
      await this.escrowTransactionService.createTransaction({
        escrowId: milestone.escrowId,
        milestoneId: milestoneId,
        type: "partial_release",
        amount: amount,
        initiatedBy: releasedBy,
        description: `Milestone completion: ${milestone.title}`,
      })

      // Mark milestone as completed
      await this.milestoneService.completeMilestone(milestoneId, releasedBy)

      this.logger.log(`Funds released for milestone ${milestoneId}`)
    } catch (error) {
      this.logger.error(`Failed to release funds for milestone ${milestoneId}:`, error)
      throw error
    }
  }
}
