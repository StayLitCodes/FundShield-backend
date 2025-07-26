import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import type { Escrow } from "../entities/escrow.entity"
import type { CreateEscrowDto } from "../dto/create-escrow.dto"
import type { UpdateEscrowDto } from "../dto/update-escrow.dto"
import type { EscrowQueryDto } from "../dto/escrow-query.dto"
import { EscrowStatus } from "../enums/escrow-status.enum"
import type { EscrowStateService } from "./escrow-state.service"
import type { EscrowAuditService } from "./escrow-audit.service"
import type { EscrowNotificationService } from "./escrow-notification.service"
import type { EscrowValidationService } from "./escrow-validation.service"
import { AuditAction } from "../enums/audit-action.enum"

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name)

  constructor(
    private escrowRepository: Repository<Escrow>,
    private escrowQueue: Queue,
    private escrowStateService: EscrowStateService,
    private escrowAuditService: EscrowAuditService,
    private escrowNotificationService: EscrowNotificationService,
    private escrowValidationService: EscrowValidationService,
  ) {}

  async createEscrow(createEscrowDto: CreateEscrowDto, createdBy: string): Promise<Escrow> {
    // Validate escrow data
    await this.escrowValidationService.validateCreateEscrow(createEscrowDto)

    // Generate unique escrow number
    const escrowNumber = await this.generateEscrowNumber()

    // Calculate fee amount
    const feeAmount = createEscrowDto.totalAmount * (createEscrowDto.feePercentage || 0.025)

    // Create escrow entity
    const escrow = this.escrowRepository.create({
      ...createEscrowDto,
      escrowNumber,
      feeAmount,
      fundingDeadline: createEscrowDto.fundingDeadline ? new Date(createEscrowDto.fundingDeadline) : null,
      completionDeadline: createEscrowDto.completionDeadline ? new Date(createEscrowDto.completionDeadline) : null,
    })

    const savedEscrow = await this.escrowRepository.save(escrow)

    // Create milestones if provided
    if (createEscrowDto.milestones && createEscrowDto.milestones.length > 0) {
      // This would be handled by MilestoneService
      await this.escrowQueue.add("create-milestones", {
        escrowId: savedEscrow.id,
        milestones: createEscrowDto.milestones,
      })
    }

    // Create conditions if provided
    if (createEscrowDto.conditions && createEscrowDto.conditions.length > 0) {
      await this.escrowQueue.add("create-conditions", {
        escrowId: savedEscrow.id,
        conditions: createEscrowDto.conditions,
      })
    }

    // Create participants if provided
    if (createEscrowDto.participants && createEscrowDto.participants.length > 0) {
      await this.escrowQueue.add("create-participants", {
        escrowId: savedEscrow.id,
        participants: createEscrowDto.participants,
      })
    }

    // Log audit trail
    await this.escrowAuditService.logAction(savedEscrow.id, AuditAction.CREATED, createdBy, {
      description: "Escrow created",
      newValues: savedEscrow,
    })

    // Send notifications
    await this.escrowNotificationService.sendEscrowCreatedNotification(savedEscrow)

    // Queue smart contract deployment if needed
    if (savedEscrow.type !== "simple") {
      await this.escrowQueue.add("deploy-smart-contract", {
        escrowId: savedEscrow.id,
      })
    }

    this.logger.log(`Escrow created: ${savedEscrow.escrowNumber}`)
    return savedEscrow
  }

  async updateEscrow(id: string, updateEscrowDto: UpdateEscrowDto, updatedBy: string): Promise<Escrow> {
    const escrow = await this.getEscrowById(id)

    // Validate state transition
    await this.escrowValidationService.validateEscrowUpdate(escrow, updateEscrowDto)

    const oldValues = { ...escrow }

    // Update escrow
    Object.assign(escrow, {
      ...updateEscrowDto,
      fundingDeadline: updateEscrowDto.fundingDeadline
        ? new Date(updateEscrowDto.fundingDeadline)
        : escrow.fundingDeadline,
      completionDeadline: updateEscrowDto.completionDeadline
        ? new Date(updateEscrowDto.completionDeadline)
        : escrow.completionDeadline,
    })

    const updatedEscrow = await this.escrowRepository.save(escrow)

    // Log audit trail
    await this.escrowAuditService.logAction(id, AuditAction.UPDATED, updatedBy, {
      description: "Escrow updated",
      oldValues,
      newValues: updatedEscrow,
    })

    this.logger.log(`Escrow updated: ${updatedEscrow.escrowNumber}`)
    return updatedEscrow
  }

  async getEscrowById(id: string): Promise<Escrow> {
    const escrow = await this.escrowRepository.findOne({
      where: { id },
      relations: ["milestones", "transactions", "participants", "conditions", "disputes", "template"],
    })

    if (!escrow) {
      throw new NotFoundException(`Escrow with ID ${id} not found`)
    }

    return escrow
  }

  async getEscrowByNumber(escrowNumber: string): Promise<Escrow> {
    const escrow = await this.escrowRepository.findOne({
      where: { escrowNumber },
      relations: ["milestones", "transactions", "participants", "conditions", "disputes", "template"],
    })

    if (!escrow) {
      throw new NotFoundException(`Escrow with number ${escrowNumber} not found`)
    }

    return escrow
  }

  async getEscrows(query: EscrowQueryDto): Promise<{ data: Escrow[]; total: number }> {
    const queryBuilder = this.escrowRepository
      .createQueryBuilder("escrow")
      .leftJoinAndSelect("escrow.milestones", "milestones")
      .leftJoinAndSelect("escrow.participants", "participants")
      .leftJoinAndSelect("escrow.template", "template")

    // Apply filters
    if (query.search) {
      queryBuilder.andWhere(
        "(escrow.title ILIKE :search OR escrow.description ILIKE :search OR escrow.escrowNumber ILIKE :search)",
        { search: `%${query.search}%` },
      )
    }

    if (query.status) {
      queryBuilder.andWhere("escrow.status = :status", { status: query.status })
    }

    if (query.type) {
      queryBuilder.andWhere("escrow.type = :type", { type: query.type })
    }

    if (query.buyerId) {
      queryBuilder.andWhere("escrow.buyerId = :buyerId", { buyerId: query.buyerId })
    }

    if (query.sellerId) {
      queryBuilder.andWhere("escrow.sellerId = :sellerId", { sellerId: query.sellerId })
    }

    if (query.startDate) {
      queryBuilder.andWhere("escrow.createdAt >= :startDate", { startDate: query.startDate })
    }

    if (query.endDate) {
      queryBuilder.andWhere("escrow.createdAt <= :endDate", { endDate: query.endDate })
    }

    if (query.minAmount) {
      queryBuilder.andWhere("escrow.totalAmount >= :minAmount", { minAmount: query.minAmount })
    }

    if (query.maxAmount) {
      queryBuilder.andWhere("escrow.totalAmount <= :maxAmount", { maxAmount: query.maxAmount })
    }

    if (query.currency) {
      queryBuilder.andWhere("escrow.currency = :currency", { currency: query.currency })
    }

    // Apply sorting
    if (query.sortBy) {
      queryBuilder.orderBy(`escrow.${query.sortBy}`, query.sortOrder || "DESC")
    } else {
      queryBuilder.orderBy("escrow.createdAt", "DESC")
    }

    // Apply pagination
    if (query.limit) {
      queryBuilder.limit(query.limit)
    }
    if (query.offset) {
      queryBuilder.offset(query.offset)
    }

    const [data, total] = await queryBuilder.getManyAndCount()

    return { data, total }
  }

  async fundEscrow(id: string, fundedBy: string, transactionData?: any): Promise<Escrow> {
    const escrow = await this.getEscrowById(id)

    // Validate state transition
    if (!this.escrowStateService.canTransitionTo(escrow.status, EscrowStatus.FUNDED)) {
      throw new BadRequestException(`Cannot fund escrow in ${escrow.status} status`)
    }

    // Update escrow status and funding info
    escrow.status = EscrowStatus.FUNDED
    escrow.lockedAmount = escrow.totalAmount
    escrow.fundedAt = new Date()

    const updatedEscrow = await this.escrowRepository.save(escrow)

    // Create funding transaction
    await this.escrowQueue.add("create-transaction", {
      escrowId: id,
      type: "deposit",
      amount: escrow.totalAmount,
      initiatedBy: fundedBy,
      transactionData,
    })

    // Log audit trail
    await this.escrowAuditService.logAction(id, AuditAction.FUNDED, fundedBy, {
      description: "Escrow funded",
      newValues: { status: EscrowStatus.FUNDED, lockedAmount: escrow.totalAmount, fundedAt: escrow.fundedAt },
    })

    // Send notifications
    await this.escrowNotificationService.sendEscrowFundedNotification(updatedEscrow)

    // Start first milestone if multi-milestone
    if (updatedEscrow.isMultiMilestone) {
      await this.escrowQueue.add("start-first-milestone", { escrowId: id })
    }

    this.logger.log(`Escrow funded: ${updatedEscrow.escrowNumber}`)
    return updatedEscrow
  }

  async releaseEscrowFunds(id: string, releasedBy: string, amount?: number): Promise<Escrow> {
    const escrow = await this.getEscrowById(id)

    // Validate state and permissions
    await this.escrowValidationService.validateFundRelease(escrow, releasedBy, amount)

    const releaseAmount = amount || escrow.lockedAmount
    escrow.releasedAmount += releaseAmount
    escrow.lockedAmount -= releaseAmount

    // Update status if fully released
    if (escrow.lockedAmount <= 0) {
      escrow.status = EscrowStatus.COMPLETED
      escrow.completedAt = new Date()
    }

    const updatedEscrow = await this.escrowRepository.save(escrow)

    // Create release transaction
    await this.escrowQueue.add("create-transaction", {
      escrowId: id,
      type: "release",
      amount: releaseAmount,
      initiatedBy: releasedBy,
    })

    // Log audit trail
    await this.escrowAuditService.logAction(id, AuditAction.FUNDS_RELEASED, releasedBy, {
      description: `Funds released: ${releaseAmount}`,
      newValues: { releasedAmount: escrow.releasedAmount, lockedAmount: escrow.lockedAmount },
    })

    // Send notifications
    await this.escrowNotificationService.sendFundsReleasedNotification(updatedEscrow, releaseAmount)

    this.logger.log(`Funds released for escrow: ${updatedEscrow.escrowNumber}, amount: ${releaseAmount}`)
    return updatedEscrow
  }

  async cancelEscrow(id: string, cancelledBy: string, reason?: string): Promise<Escrow> {
    const escrow = await this.getEscrowById(id)

    // Validate state transition
    if (!this.escrowStateService.canTransitionTo(escrow.status, EscrowStatus.CANCELLED)) {
      throw new BadRequestException(`Cannot cancel escrow in ${escrow.status} status`)
    }

    escrow.status = EscrowStatus.CANCELLED
    escrow.cancelledAt = new Date()

    const updatedEscrow = await this.escrowRepository.save(escrow)

    // Process refund if funded
    if (escrow.lockedAmount > 0) {
      await this.escrowQueue.add("create-transaction", {
        escrowId: id,
        type: "refund",
        amount: escrow.lockedAmount,
        initiatedBy: cancelledBy,
        description: reason,
      })
    }

    // Log audit trail
    await this.escrowAuditService.logAction(id, AuditAction.CANCELLED, cancelledBy, {
      description: `Escrow cancelled: ${reason || "No reason provided"}`,
      newValues: { status: EscrowStatus.CANCELLED, cancelledAt: escrow.cancelledAt },
    })

    // Send notifications
    await this.escrowNotificationService.sendEscrowCancelledNotification(updatedEscrow, reason)

    this.logger.log(`Escrow cancelled: ${updatedEscrow.escrowNumber}`)
    return updatedEscrow
  }

  async getEscrowHistory(id: string): Promise<any[]> {
    return this.escrowAuditService.getEscrowHistory(id)
  }

  async getEscrowStatistics(userId?: string): Promise<Record<string, any>> {
    const queryBuilder = this.escrowRepository.createQueryBuilder("escrow")

    if (userId) {
      queryBuilder.where("escrow.buyerId = :userId OR escrow.sellerId = :userId", { userId })
    }

    const [total, created, funded, inProgress, completed, cancelled, disputed] = await Promise.all([
      queryBuilder.getCount(),
      queryBuilder.clone().andWhere("escrow.status = :status", { status: EscrowStatus.CREATED }).getCount(),
      queryBuilder.clone().andWhere("escrow.status = :status", { status: EscrowStatus.FUNDED }).getCount(),
      queryBuilder.clone().andWhere("escrow.status = :status", { status: EscrowStatus.IN_PROGRESS }).getCount(),
      queryBuilder.clone().andWhere("escrow.status = :status", { status: EscrowStatus.COMPLETED }).getCount(),
      queryBuilder.clone().andWhere("escrow.status = :status", { status: EscrowStatus.CANCELLED }).getCount(),
      queryBuilder.clone().andWhere("escrow.status = :status", { status: EscrowStatus.DISPUTED }).getCount(),
    ])

    const totalValue = await queryBuilder.select("SUM(escrow.totalAmount)", "sum").getRawOne()

    const lockedValue = await queryBuilder
      .clone()
      .andWhere("escrow.status IN (:...statuses)", {
        statuses: [EscrowStatus.FUNDED, EscrowStatus.IN_PROGRESS, EscrowStatus.MILESTONE_PENDING],
      })
      .select("SUM(escrow.lockedAmount)", "sum")
      .getRawOne()

    return {
      total,
      byStatus: {
        created,
        funded,
        inProgress,
        completed,
        cancelled,
        disputed,
      },
      totalValue: Number(totalValue.sum) || 0,
      lockedValue: Number(lockedValue.sum) || 0,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    }
  }

  private async generateEscrowNumber(): Promise<string> {
    const prefix = "ESC"
    const timestamp = Date.now().toString().slice(-8)
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `${prefix}-${timestamp}-${random}`
  }
}
