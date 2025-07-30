import { Injectable, BadRequestException } from "@nestjs/common"
import type { CreateEscrowDto } from "../dto/create-escrow.dto"
import type { UpdateEscrowDto } from "../dto/update-escrow.dto"
import type { Escrow } from "../entities/escrow.entity"
import { EscrowStatus } from "../enums/escrow-status.enum"

@Injectable()
export class EscrowValidationService {
  async validateCreateEscrow(createEscrowDto: CreateEscrowDto): Promise<void> {
    // Validate amount
    if (createEscrowDto.totalAmount <= 0) {
      throw new BadRequestException("Total amount must be greater than 0")
    }

    // Validate participants
    if (createEscrowDto.buyerId === createEscrowDto.sellerId) {
      throw new BadRequestException("Buyer and seller cannot be the same person")
    }

    // Validate milestones if multi-milestone
    if (createEscrowDto.isMultiMilestone && createEscrowDto.milestones) {
      const totalPercentage = createEscrowDto.milestones.reduce((sum, m) => sum + m.percentage, 0)
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new BadRequestException("Milestone percentages must sum to 100%")
      }
    }

    // Validate deadlines
    if (createEscrowDto.fundingDeadline && createEscrowDto.completionDeadline) {
      const fundingDate = new Date(createEscrowDto.fundingDeadline)
      const completionDate = new Date(createEscrowDto.completionDeadline)

      if (fundingDate >= completionDate) {
        throw new BadRequestException("Funding deadline must be before completion deadline")
      }
    }

    // Validate fee percentage
    if (createEscrowDto.feePercentage && (createEscrowDto.feePercentage < 0 || createEscrowDto.feePercentage > 1)) {
      throw new BadRequestException("Fee percentage must be between 0 and 1")
    }
  }

  async validateEscrowUpdate(escrow: Escrow, updateEscrowDto: UpdateEscrowDto): Promise<void> {
    // Prevent updates to completed or cancelled escrows
    if ([EscrowStatus.COMPLETED, EscrowStatus.CANCELLED, EscrowStatus.REFUNDED].includes(escrow.status)) {
      throw new BadRequestException(`Cannot update escrow in ${escrow.status} status`)
    }

    // Validate deadline updates
    if (updateEscrowDto.fundingDeadline && updateEscrowDto.completionDeadline) {
      const fundingDate = new Date(updateEscrowDto.fundingDeadline)
      const completionDate = new Date(updateEscrowDto.completionDeadline)

      if (fundingDate >= completionDate) {
        throw new BadRequestException("Funding deadline must be before completion deadline")
      }
    }
  }

  async validateFundRelease(escrow: Escrow, releasedBy: string, amount?: number): Promise<void> {
    // Check if escrow is funded
    if (escrow.lockedAmount <= 0) {
      throw new BadRequestException("No funds available for release")
    }

    // Validate release amount
    if (amount && amount > escrow.lockedAmount) {
      throw new BadRequestException("Release amount cannot exceed locked amount")
    }

    // Check escrow status
    const validStatuses = [EscrowStatus.FUNDED, EscrowStatus.IN_PROGRESS, EscrowStatus.MILESTONE_PENDING]
    if (!validStatuses.includes(escrow.status)) {
      throw new BadRequestException(`Cannot release funds from escrow in ${escrow.status} status`)
    }

    // Additional authorization checks could be added here
    // For example, checking if the user has permission to release funds
  }

  async validateMilestoneTransition(milestone: any, newStatus: string): Promise<void> {
    // Add milestone-specific validation logic
    // This could include checking requirements, deliverables, etc.
  }
}
