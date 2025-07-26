import { Injectable } from "@nestjs/common"
import { EscrowStatus } from "../enums/escrow-status.enum"

@Injectable()
export class EscrowStateService {
  private readonly stateTransitions: Record<EscrowStatus, EscrowStatus[]> = {
    [EscrowStatus.CREATED]: [
      EscrowStatus.FUNDING_PENDING,
      EscrowStatus.FUNDED,
      EscrowStatus.CANCELLED,
      EscrowStatus.EXPIRED,
    ],
    [EscrowStatus.FUNDING_PENDING]: [EscrowStatus.FUNDED, EscrowStatus.CANCELLED, EscrowStatus.EXPIRED],
    [EscrowStatus.FUNDED]: [
      EscrowStatus.IN_PROGRESS,
      EscrowStatus.MILESTONE_PENDING,
      EscrowStatus.COMPLETED,
      EscrowStatus.DISPUTED,
      EscrowStatus.CANCELLED,
    ],
    [EscrowStatus.IN_PROGRESS]: [
      EscrowStatus.MILESTONE_PENDING,
      EscrowStatus.COMPLETED,
      EscrowStatus.DISPUTED,
      EscrowStatus.CANCELLED,
    ],
    [EscrowStatus.MILESTONE_PENDING]: [
      EscrowStatus.IN_PROGRESS,
      EscrowStatus.COMPLETED,
      EscrowStatus.DISPUTED,
      EscrowStatus.CANCELLED,
    ],
    [EscrowStatus.COMPLETED]: [],
    [EscrowStatus.CANCELLED]: [EscrowStatus.REFUNDED],
    [EscrowStatus.DISPUTED]: [
      EscrowStatus.IN_PROGRESS,
      EscrowStatus.COMPLETED,
      EscrowStatus.CANCELLED,
      EscrowStatus.REFUNDED,
    ],
    [EscrowStatus.EXPIRED]: [EscrowStatus.REFUNDED],
    [EscrowStatus.REFUNDED]: [],
  }

  canTransitionTo(currentStatus: EscrowStatus, targetStatus: EscrowStatus): boolean {
    const allowedTransitions = this.stateTransitions[currentStatus] || []
    return allowedTransitions.includes(targetStatus)
  }

  getNextPossibleStates(currentStatus: EscrowStatus): EscrowStatus[] {
    return this.stateTransitions[currentStatus] || []
  }

  isTerminalState(status: EscrowStatus): boolean {
    const terminalStates = [EscrowStatus.COMPLETED, EscrowStatus.REFUNDED]
    return terminalStates.includes(status)
  }

  getStateDescription(status: EscrowStatus): string {
    const descriptions: Record<EscrowStatus, string> = {
      [EscrowStatus.CREATED]: "Escrow has been created and is awaiting funding",
      [EscrowStatus.FUNDING_PENDING]: "Escrow is waiting for funds to be deposited",
      [EscrowStatus.FUNDED]: "Escrow has been funded and is ready to proceed",
      [EscrowStatus.IN_PROGRESS]: "Escrow is active and work is in progress",
      [EscrowStatus.MILESTONE_PENDING]: "Escrow is waiting for milestone completion or approval",
      [EscrowStatus.COMPLETED]: "Escrow has been completed successfully",
      [EscrowStatus.CANCELLED]: "Escrow has been cancelled",
      [EscrowStatus.DISPUTED]: "Escrow is under dispute resolution",
      [EscrowStatus.EXPIRED]: "Escrow has expired due to missed deadlines",
      [EscrowStatus.REFUNDED]: "Escrow funds have been refunded",
    }

    return descriptions[status] || "Unknown status"
  }

  validateStateTransition(
    currentStatus: EscrowStatus,
    targetStatus: EscrowStatus,
    context?: Record<string, any>,
  ): { valid: boolean; reason?: string } {
    if (!this.canTransitionTo(currentStatus, targetStatus)) {
      return {
        valid: false,
        reason: `Cannot transition from ${currentStatus} to ${targetStatus}`,
      }
    }

    // Additional validation based on context
    if (context) {
      // Example: Check if escrow is funded before allowing certain transitions
      if (targetStatus === EscrowStatus.IN_PROGRESS && !context.isFunded) {
        return {
          valid: false,
          reason: "Escrow must be funded before it can be set to in progress",
        }
      }

      // Check if all milestones are completed before allowing completion
      if (targetStatus === EscrowStatus.COMPLETED && context.hasIncompleteMilestones) {
        return {
          valid: false,
          reason: "All milestones must be completed before escrow can be marked as completed",
        }
      }

      // Check if dispute is resolved before allowing certain transitions
      if (currentStatus === EscrowStatus.DISPUTED && context.hasUnresolvedDispute) {
        return {
          valid: false,
          reason: "Dispute must be resolved before changing escrow status",
        }
      }
    }

    return { valid: true }
  }

  getRequiredConditionsForTransition(currentStatus: EscrowStatus, targetStatus: EscrowStatus): string[] {
    const conditions: Record<string, string[]> = {
      [`${EscrowStatus.CREATED}-${EscrowStatus.FUNDED}`]: ["Funds must be deposited", "Payment method verified"],
      [`${EscrowStatus.FUNDED}-${EscrowStatus.IN_PROGRESS}`]: ["All parties confirmed", "Terms accepted"],
      [`${EscrowStatus.IN_PROGRESS}-${EscrowStatus.COMPLETED}`]: [
        "All milestones completed",
        "Deliverables approved",
        "No active disputes",
      ],
      [`${EscrowStatus.MILESTONE_PENDING}-${EscrowStatus.IN_PROGRESS}`]: ["Milestone approved or rejected"],
      [`${EscrowStatus.DISPUTED}-${EscrowStatus.COMPLETED}`]: ["Dispute resolved in favor of completion"],
    }

    const key = `${currentStatus}-${targetStatus}`
    return conditions[key] || []
  }
}
