import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import type { EscrowMilestone } from "../entities/escrow-milestone.entity"
import type {
  CreateMilestoneDto,
  UpdateMilestoneDto,
  ApproveMilestoneDto,
  RejectMilestoneDto,
} from "../dto/milestone.dto"
import { MilestoneStatus } from "../enums/milestone-status.enum"
import type { EscrowService } from "./escrow.service"
import type { EscrowAuditService } from "./escrow-audit.service"
import type { EscrowNotificationService } from "./escrow-notification.service"
import { AuditAction } from "../enums/audit-action.enum"

@Injectable()
export class MilestoneService {
  private readonly logger = new Logger(MilestoneService.name)

  constructor(
    private milestoneRepository: Repository<EscrowMilestone>,
    private milestoneQueue: Queue,
    private escrowService: EscrowService,
    private escrowAuditService: EscrowAuditService,
    private escrowNotificationService: EscrowNotificationService,
  ) {}

  async createMilestone(createMilestoneDto: CreateMilestoneDto, createdBy: string): Promise<EscrowMilestone> {
    // Verify escrow exists
    const escrow = await this.escrowService.getEscrowById(createMilestoneDto.escrowId)

    // Calculate amount based on percentage if not provided
    const amount = createMilestoneDto.amount || (escrow.totalAmount * createMilestoneDto.percentage) / 100

    const milestone = this.milestoneRepository.create({
      ...createMilestoneDto,
      amount,
      dueDate: createMilestoneDto.dueDate ? new Date(createMilestoneDto.dueDate) : null,
      requirements:
        createMilestoneDto.requirements?.map((req, index) => ({
          id: `req_${index + 1}`,
          description: req.description,
          type: req.type,
          completed: false,
        })) || [],
      deliverables:
        createMilestoneDto.deliverables?.map((del, index) => ({
          id: `del_${index + 1}`,
          name: del.name,
          description: del.description,
          approved: false,
        })) || [],
    })

    const savedMilestone = await this.milestoneRepository.save(milestone)

    // Log audit trail
    await this.escrowAuditService.logAction(createMilestoneDto.escrowId, AuditAction.MILESTONE_COMPLETED, createdBy, {
      description: `Milestone created: ${savedMilestone.title}`,
      newValues: savedMilestone,
    })

    // Send notifications
    await this.escrowNotificationService.sendMilestoneCreatedNotification(escrow, savedMilestone)

    this.logger.log(`Milestone created: ${savedMilestone.title} for escrow ${escrow.escrowNumber}`)
    return savedMilestone
  }

  async updateMilestone(
    id: string,
    updateMilestoneDto: UpdateMilestoneDto,
    updatedBy: string,
  ): Promise<EscrowMilestone> {
    const milestone = await this.getMilestoneById(id)
    const oldValues = { ...milestone }

    Object.assign(milestone, {
      ...updateMilestoneDto,
      dueDate: updateMilestoneDto.dueDate ? new Date(updateMilestoneDto.dueDate) : milestone.dueDate,
    })

    const updatedMilestone = await this.milestoneRepository.save(milestone)

    // Log audit trail
    await this.escrowAuditService.logAction(milestone.escrowId, AuditAction.UPDATED, updatedBy, {
      description: `Milestone updated: ${updatedMilestone.title}`,
      oldValues,
      newValues: updatedMilestone,
    })

    this.logger.log(`Milestone updated: ${updatedMilestone.title}`)
    return updatedMilestone
  }

  async getMilestoneById(id: string): Promise<EscrowMilestone> {
    const milestone = await this.milestoneRepository.findOne({
      where: { id },
      relations: ["escrow", "transactions"],
    })

    if (!milestone) {
      throw new NotFoundException(`Milestone with ID ${id} not found`)
    }

    return milestone
  }

  async getEscrowMilestones(escrowId: string): Promise<EscrowMilestone[]> {
    return this.milestoneRepository.find({
      where: { escrowId },
      order: { order: "ASC" },
      relations: ["transactions"],
    })
  }

  async startMilestone(id: string, startedBy: string): Promise<EscrowMilestone> {
    const milestone = await this.getMilestoneById(id)

    if (milestone.status !== MilestoneStatus.PENDING) {
      throw new BadRequestException(`Cannot start milestone in ${milestone.status} status`)
    }

    milestone.status = MilestoneStatus.IN_PROGRESS
    milestone.startedAt = new Date()

    const updatedMilestone = await this.milestoneRepository.save(milestone)

    // Log audit trail
    await this.escrowAuditService.logAction(milestone.escrowId, AuditAction.MILESTONE_COMPLETED, startedBy, {
      description: `Milestone started: ${updatedMilestone.title}`,
      newValues: { status: MilestoneStatus.IN_PROGRESS, startedAt: updatedMilestone.startedAt },
    })

    // Send notifications
    await this.escrowNotificationService.sendMilestoneStartedNotification(milestone.escrow, updatedMilestone)

    this.logger.log(`Milestone started: ${updatedMilestone.title}`)
    return updatedMilestone
  }

  async submitMilestone(id: string, submittedBy: string, deliverables?: any[]): Promise<EscrowMilestone> {
    const milestone = await this.getMilestoneById(id)

    if (milestone.status !== MilestoneStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot submit milestone in ${milestone.status} status`)
    }

    // Update deliverables if provided
    if (deliverables) {
      milestone.deliverables = milestone.deliverables.map((del) => {
        const submitted = deliverables.find((sub) => sub.id === del.id)
        if (submitted) {
          return {
            ...del,
            fileUrl: submitted.fileUrl,
            submittedAt: new Date(),
          }
        }
        return del
      })
    }

    milestone.status = MilestoneStatus.SUBMITTED
    const updatedMilestone = await this.milestoneRepository.save(milestone)

    // Queue for auto-approval if enabled
    if (milestone.autoApprove && milestone.autoApproveDelayHours > 0) {
      await this.milestoneQueue.add(
        "auto-approve-milestone",
        { milestoneId: id },
        { delay: milestone.autoApproveDelayHours * 60 * 60 * 1000 },
      )
    }

    // Log audit trail
    await this.escrowAuditService.logAction(milestone.escrowId, AuditAction.MILESTONE_COMPLETED, submittedBy, {
      description: `Milestone submitted: ${updatedMilestone.title}`,
      newValues: { status: MilestoneStatus.SUBMITTED, deliverables: updatedMilestone.deliverables },
    })

    // Send notifications
    await this.escrowNotificationService.sendMilestoneSubmittedNotification(milestone.escrow, updatedMilestone)

    this.logger.log(`Milestone submitted: ${updatedMilestone.title}`)
    return updatedMilestone
  }

  async approveMilestone(
    id: string,
    approveMilestoneDto: ApproveMilestoneDto,
    approvedBy: string,
  ): Promise<EscrowMilestone> {
    const milestone = await this.getMilestoneById(id)

    if (![MilestoneStatus.SUBMITTED, MilestoneStatus.UNDER_REVIEW].includes(milestone.status)) {
      throw new BadRequestException(`Cannot approve milestone in ${milestone.status} status`)
    }

    milestone.status = MilestoneStatus.APPROVED
    milestone.approvedAt = new Date()
    milestone.approvedBy = approvedBy
    milestone.approvalNotes = approveMilestoneDto.approvalNotes

    const updatedMilestone = await this.milestoneRepository.save(milestone)

    // Queue fund release
    await this.milestoneQueue.add("release-milestone-funds", {
      milestoneId: id,
      amount: milestone.amount,
      releasedBy: approvedBy,
    })

    // Log audit trail
    await this.escrowAuditService.logAction(milestone.escrowId, AuditAction.MILESTONE_COMPLETED, approvedBy, {
      description: `Milestone approved: ${updatedMilestone.title}`,
      newValues: {
        status: MilestoneStatus.APPROVED,
        approvedAt: updatedMilestone.approvedAt,
        approvedBy,
        approvalNotes: approveMilestoneDto.approvalNotes,
      },
    })

    // Send notifications
    await this.escrowNotificationService.sendMilestoneApprovedNotification(milestone.escrow, updatedMilestone)

    // Check if all milestones are completed
    await this.checkEscrowCompletion(milestone.escrowId)

    this.logger.log(`Milestone approved: ${updatedMilestone.title}`)
    return updatedMilestone
  }

  async rejectMilestone(
    id: string,
    rejectMilestoneDto: RejectMilestoneDto,
    rejectedBy: string,
  ): Promise<EscrowMilestone> {
    const milestone = await this.getMilestoneById(id)

    if (![MilestoneStatus.SUBMITTED, MilestoneStatus.UNDER_REVIEW].includes(milestone.status)) {
      throw new BadRequestException(`Cannot reject milestone in ${milestone.status} status`)
    }

    milestone.status = MilestoneStatus.REJECTED
    milestone.approvalNotes = rejectMilestoneDto.rejectionReason

    const updatedMilestone = await this.milestoneRepository.save(milestone)

    // Log audit trail
    await this.escrowAuditService.logAction(milestone.escrowId, AuditAction.MILESTONE_COMPLETED, rejectedBy, {
      description: `Milestone rejected: ${updatedMilestone.title}`,
      newValues: {
        status: MilestoneStatus.REJECTED,
        approvalNotes: rejectMilestoneDto.rejectionReason,
      },
    })

    // Send notifications
    await this.escrowNotificationService.sendMilestoneRejectedNotification(
      milestone.escrow,
      updatedMilestone,
      rejectMilestoneDto.rejectionReason,
    )

    this.logger.log(`Milestone rejected: ${updatedMilestone.title}`)
    return updatedMilestone
  }

  async completeMilestone(id: string, completedBy: string): Promise<EscrowMilestone> {
    const milestone = await this.getMilestoneById(id)

    if (milestone.status !== MilestoneStatus.APPROVED) {
      throw new BadRequestException(`Cannot complete milestone in ${milestone.status} status`)
    }

    milestone.status = MilestoneStatus.COMPLETED
    milestone.completedAt = new Date()

    const updatedMilestone = await this.milestoneRepository.save(milestone)

    // Log audit trail
    await this.escrowAuditService.logAction(milestone.escrowId, AuditAction.MILESTONE_COMPLETED, completedBy, {
      description: `Milestone completed: ${updatedMilestone.title}`,
      newValues: { status: MilestoneStatus.COMPLETED, completedAt: updatedMilestone.completedAt },
    })

    // Send notifications
    await this.escrowNotificationService.sendMilestoneCompletedNotification(milestone.escrow, updatedMilestone)

    this.logger.log(`Milestone completed: ${updatedMilestone.title}`)
    return updatedMilestone
  }

  async updateRequirement(
    milestoneId: string,
    requirementId: string,
    completed: boolean,
    completedBy?: string,
  ): Promise<EscrowMilestone> {
    const milestone = await this.getMilestoneById(milestoneId)

    milestone.requirements = milestone.requirements.map((req) => {
      if (req.id === requirementId) {
        return {
          ...req,
          completed,
          completedAt: completed ? new Date() : undefined,
          completedBy: completed ? completedBy : undefined,
        }
      }
      return req
    })

    const updatedMilestone = await this.milestoneRepository.save(milestone)

    // Check if all requirements are completed
    const allRequirementsCompleted = milestone.requirements.every((req) => req.completed)
    if (allRequirementsCompleted && milestone.status === MilestoneStatus.IN_PROGRESS) {
      // Auto-submit if all requirements are completed
      await this.submitMilestone(milestoneId, completedBy || "system")
    }

    this.logger.log(`Requirement ${requirementId} updated for milestone: ${updatedMilestone.title}`)
    return updatedMilestone
  }

  async getMilestoneProgress(escrowId: string): Promise<{
    totalMilestones: number
    completedMilestones: number
    progressPercentage: number
    currentMilestone?: EscrowMilestone
    nextMilestone?: EscrowMilestone
  }> {
    const milestones = await this.getEscrowMilestones(escrowId)

    const totalMilestones = milestones.length
    const completedMilestones = milestones.filter((m) => m.status === MilestoneStatus.COMPLETED).length
    const progressPercentage = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0

    const currentMilestone = milestones.find((m) =>
      [MilestoneStatus.IN_PROGRESS, MilestoneStatus.SUBMITTED, MilestoneStatus.UNDER_REVIEW].includes(m.status),
    )

    const nextMilestone = milestones.find((m) => m.status === MilestoneStatus.PENDING)

    return {
      totalMilestones,
      completedMilestones,
      progressPercentage,
      currentMilestone,
      nextMilestone,
    }
  }

  private async checkEscrowCompletion(escrowId: string): Promise<void> {
    const milestones = await this.getEscrowMilestones(escrowId)
    const allCompleted = milestones.every((m) => m.status === MilestoneStatus.COMPLETED)

    if (allCompleted && milestones.length > 0) {
      // Queue escrow completion
      await this.milestoneQueue.add("complete-escrow", { escrowId })
    }
  }
}
