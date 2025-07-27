import { Injectable, type CanActivate, type ExecutionContext, ForbiddenException } from "@nestjs/common"
import type { EscrowService } from "../services/escrow.service"

@Injectable()
export class EscrowOwnershipGuard implements CanActivate {
  constructor(private escrowService: EscrowService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const escrowId = request.params.id || request.body.escrowId
    const userId = request.user?.id

    if (!userId) {
      throw new ForbiddenException("User not authenticated")
    }

    if (!escrowId) {
      throw new ForbiddenException("Escrow ID not provided")
    }

    try {
      const escrow = await this.escrowService.getEscrowById(escrowId)

      // Check if user is buyer, seller, or has admin role
      const isOwner = escrow.buyerId === userId || escrow.sellerId === userId
      const isAdmin = request.user?.roles?.includes("admin")

      if (!isOwner && !isAdmin) {
        throw new ForbiddenException("You do not have permission to access this escrow")
      }

      return true
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error
      }
      throw new ForbiddenException("Unable to verify escrow ownership")
    }
  }
}
