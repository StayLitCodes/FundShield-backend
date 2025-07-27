import { Injectable, type CanActivate, type ExecutionContext, BadRequestException } from "@nestjs/common"
import type { EscrowService } from "../services/escrow.service"
import type { EscrowStateService } from "../services/escrow-state.service"

@Injectable()
export class EscrowStateGuard implements CanActivate {
  constructor(
    private escrowService: EscrowService,
    private escrowStateService: EscrowStateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const escrowId = request.params.id
    const action = this.getActionFromRoute(request.route?.path)

    if (!escrowId || !action) {
      return true // Let other guards handle validation
    }

    try {
      const escrow = await this.escrowService.getEscrowById(escrowId)
      const targetStatus = this.getTargetStatusForAction(action)

      if (targetStatus) {
        const validation = this.escrowStateService.validateStateTransition(escrow.status, targetStatus, {
          isFunded: escrow.lockedAmount > 0,
          hasIncompleteMilestones: false, // This would be calculated
          hasUnresolvedDispute: false, // This would be calculated
        })

        if (!validation.valid) {
          throw new BadRequestException(validation.reason)
        }
      }

      return true
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }
      throw new BadRequestException("Unable to validate escrow state")
    }
  }

  private getActionFromRoute(routePath?: string): string | null {
    if (!routePath) return null

    if (routePath.includes("/fund")) return "fund"
    if (routePath.includes("/release")) return "release"
    if (routePath.includes("/cancel")) return "cancel"

    return null
  }

  private getTargetStatusForAction(action: string): any {
    const actionStatusMap: Record<string, any> = {
      fund: "funded",
      release: "completed",
      cancel: "cancelled",
    }

    return actionStatusMap[action]
  }
}
