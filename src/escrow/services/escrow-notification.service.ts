import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { EscrowNotification } from "../entities/escrow-notification.entity"
import type { Escrow } from "../entities/escrow.entity"
import type { EscrowMilestone } from "../entities/escrow-milestone.entity"
import { NotificationType } from "../enums/notification-type.enum"
import type { EscrowGateway } from "../gateways/escrow.gateway"

@Injectable()
export class EscrowNotificationService {
  private readonly logger = new Logger(EscrowNotificationService.name)

  constructor(
    private notificationRepository: Repository<EscrowNotification>,
    private escrowGateway: EscrowGateway,
  ) {}

  async sendEscrowCreatedNotification(escrow: Escrow): Promise<void> {
    const notifications = [
      {
        escrowId: escrow.id,
        userId: escrow.buyerId,
        type: NotificationType.ESCROW_CREATED,
        title: "Escrow Created",
        message: `Escrow "${escrow.title}" has been created. Please review the terms and fund the escrow.`,
        data: { escrowNumber: escrow.escrowNumber, amount: escrow.totalAmount },
      },
      {
        escrowId: escrow.id,
        userId: escrow.sellerId,
        type: NotificationType.ESCROW_CREATED,
        title: "New Escrow Assignment",
        message: `You have been assigned to escrow "${escrow.title}". Please review the terms.`,
        data: { escrowNumber: escrow.escrowNumber, amount: escrow.totalAmount },
      },
    ]

    await this.createAndSendNotifications(notifications)
  }

  async sendEscrowFundedNotification(escrow: Escrow): Promise<void> {
    const notifications = [
      {
        escrowId: escrow.id,
        userId: escrow.sellerId,
        type: NotificationType.ESCROW_FUNDED,
        title: "Escrow Funded",
        message: `Escrow "${escrow.title}" has been funded. You can now begin work.`,
        data: { escrowNumber: escrow.escrowNumber, amount: escrow.totalAmount },
      },
    ]

    await this.createAndSendNotifications(notifications)
  }

  async sendMilestoneCreatedNotification(escrow: Escrow, milestone: EscrowMilestone): Promise<void> {
    const notifications = [
      {
        escrowId: escrow.id,
        userId: escrow.sellerId,
        type: NotificationType.MILESTONE_STARTED,
        title: "New Milestone",
        message: `Milestone "${milestone.title}" has been created for escrow "${escrow.title}".`,
        data: {
          escrowNumber: escrow.escrowNumber,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          amount: milestone.amount,
        },
      },
    ]

    await this.createAndSendNotifications(notifications)
  }

  async sendMilestoneStartedNotification(escrow: Escrow, milestone: EscrowMilestone): Promise<void> {
    const notifications = [
      {
        escrowId: escrow.id,
        userId: escrow.buyerId,
        type: NotificationType.MILESTONE_STARTED,
        title: "Milestone Started",
        message: `Milestone "${milestone.title}" has been started for escrow "${escrow.title}".`,
        data: {
          escrowNumber: escrow.escrowNumber,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
        },
      },
    ]

    await this.createAndSendNotifications(notifications)
  }

  async sendMilestoneSubmittedNotification(escrow: Escrow, milestone: EscrowMilestone): Promise<void> {
    const notifications = [
      {
        escrowId: escrow.id,
        userId: escrow.buyerId,
        type: NotificationType.MILESTONE_COMPLETED,
        title: "Milestone Submitted",
        message: `Milestone "${milestone.title}" has been submitted for review in escrow "${escrow.title}".`,
        data: {
          escrowNumber: escrow.escrowNumber,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
        },
      },
    ]

    await this.createAndSendNotifications(notifications)
  }

  async sendMilestoneApprovedNotification(escrow: Escrow, milestone: EscrowMilestone): Promise<void> {
    const notifications = [
      {
        escrowId: escrow.id,
        userId: escrow.sellerId,
        type: NotificationType.MILESTONE_APPROVED,
        title: "Milestone Approved",
        message: `Milestone "${milestone.title}" has been approved. Funds will be released shortly.`,
        data: {
          escrowNumber: escrow.escrowNumber,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          amount: milestone.amount,
        },
      },
    ]

    await this.createAndSendNotifications(notifications)
  }

  async sendMilestoneRejectedNotification(escrow: Escrow, milestone: EscrowMilestone, reason: string): Promise<void> {
    const notifications = [
      {
        escrowId: escrow.id,
        userId: escrow.sellerId,
        type: NotificationType.MILESTONE_REJECTED,
        title: "Milestone Rejected",
        message: `Milestone "${milestone.title}" has been rejected. Reason: ${reason}`,
        data: {
          escrowNumber: escrow.escrowNumber,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          rejectionReason: reason,
        },
      },
    ]

    await this.createAndSendNotifications(notifications)
  }

  async sendMilestoneCompletedNotification(escrow: Escrow, milestone: EscrowMilestone): Promise<void> {
    const notifications = [
      {
        escrowId: escrow.id,
        userId: escrow.buyerId,
        type: NotificationType.MILESTONE_COMPLETED,
        title: "Milestone Completed",
        message: `Milestone "${milestone.title}" has been completed for escrow "${escrow.title}".`,
        data: {
          escrowNumber: escrow.escrowNumber,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
        },
      },
      {
        escrowId: escrow.id,
        userId: escrow.sellerId,
        type: NotificationType.MILESTONE_COMPLETED,
        title: "Milestone Completed",
        message: `Milestone "${milestone.title}" has been completed for escrow "${escrow.title}".`,
        data: {
          escrowNumber: escrow.escrowNumber,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
        },
      },
    ]

    await this.createAndSendNotifications(notifications)
  }

  async sendFundsReleasedNotification(escrow: Escrow, amount: number): Promise<void> {
    const notifications = [
      {
        escrowId: escrow.id,
        userId: escrow.sellerId,
        type: NotificationType.FUNDS_RELEASED,
        title: "Funds Released",
        message: `${amount} ${escrow.currency} has been released from escrow "${escrow.title}".`,
        data: {
          escrowNumber: escrow.escrowNumber,
          amount,
          currency: escrow.currency,
        },
      },
      {
        escrowId: escrow.id,
        userId: escrow.buyerId,
        type: NotificationType.FUNDS_RELEASED,
        title: "Funds Released",
        message: `${amount} ${escrow.currency} has been released to the seller for escrow "${escrow.title}".`,
        data: {
          escrowNumber: escrow.escrowNumber,
          amount,
          currency: escrow.currency,
        },
      },
    ]

    await this.createAndSendNotifications(notifications)
  }

  async sendEscrowCompletedNotification(escrow: Escrow): Promise<void> {
    const notifications = [
      {
        escrowId: escrow.id,
        userId: escrow.buyerId,
        type: NotificationType.ESCROW_COMPLETED,
        title: "Escrow Completed",
        message: `Escrow "${escrow.title}" has been completed successfully.`,
        data: {
          escrowNumber: escrow.escrowNumber,
          totalAmount: escrow.totalAmount,
        },
      },
      {
        escrowId: escrow.id,
        userId: escrow.sellerId,
        type: NotificationType.ESCROW_COMPLETED,
        title: "Escrow Completed",
        message: `Escrow "${escrow.title}" has been completed successfully.`,
        data: {
          escrowNumber: escrow.escrowNumber,
          totalAmount: escrow.totalAmount,
        },
      },
    ]

    await this.createAndSendNotifications(notifications)
  }

  async sendEscrowCancelledNotification(escrow: Escrow, reason?: string): Promise<void> {
    const notifications = [
      {
        escrowId: escrow.id,
        userId: escrow.buyerId,
        type: NotificationType.ESCROW_CANCELLED,
        title: "Escrow Cancelled",
        message: `Escrow "${escrow.title}" has been cancelled. ${reason ? `Reason: ${reason}` : ""}`,
        data: {
          escrowNumber: escrow.escrowNumber,
          reason,
        },
      },
      {
        escrowId: escrow.id,
        userId: escrow.sellerId,
        type: NotificationType.ESCROW_CANCELLED,
        title: "Escrow Cancelled",
        message: `Escrow "${escrow.title}" has been cancelled. ${reason ? `Reason: ${reason}` : ""}`,
        data: {
          escrowNumber: escrow.escrowNumber,
          reason,
        },
      },
    ]

    await this.createAndSendNotifications(notifications)
  }

  async sendDeadlineApproachingNotification(
    escrow: Escrow,
    deadline: Date,
    type: "funding" | "completion",
  ): Promise<void> {
    const notifications = [
      {
        escrowId: escrow.id,
        userId: type === "funding" ? escrow.buyerId : escrow.sellerId,
        type: NotificationType.DEADLINE_APPROACHING,
        title: "Deadline Approaching",
        message: `The ${type} deadline for escrow "${escrow.title}" is approaching (${deadline.toLocaleDateString()}).`,
        data: {
          escrowNumber: escrow.escrowNumber,
          deadline: deadline.toISOString(),
          deadlineType: type,
        },
      },
    ]

    await this.createAndSendNotifications(notifications)
  }

  async sendDisputeRaisedNotification(escrow: Escrow, disputeId: string, initiatedBy: string): Promise<void> {
    const otherParty = initiatedBy === escrow.buyerId ? escrow.sellerId : escrow.buyerId

    const notifications = [
      {
        escrowId: escrow.id,
        userId: otherParty,
        type: NotificationType.DISPUTE_RAISED,
        title: "Dispute Raised",
        message: `A dispute has been raised for escrow "${escrow.title}".`,
        data: {
          escrowNumber: escrow.escrowNumber,
          disputeId,
          initiatedBy,
        },
      },
    ]

    await this.createAndSendNotifications(notifications)
  }

  async getUserNotifications(userId: string, unreadOnly = false): Promise<EscrowNotification[]> {
    const queryBuilder = this.notificationRepository
      .createQueryBuilder("notification")
      .where("notification.userId = :userId", { userId })
      .orderBy("notification.createdAt", "DESC")

    if (unreadOnly) {
      queryBuilder.andWhere("notification.isRead = false")
    }

    return queryBuilder.getMany()
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.notificationRepository.update(notificationId, {
      isRead: true,
      readAt: new Date(),
    })
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update({ userId, isRead: false }, { isRead: true, readAt: new Date() })
  }

  private async createAndSendNotifications(
    notifications: Array<{
      escrowId: string
      userId: string
      type: NotificationType
      title: string
      message: string
      data: Record<string, any>
    }>,
  ): Promise<void> {
    for (const notificationData of notifications) {
      const notification = this.notificationRepository.create(notificationData)
      const savedNotification = await this.notificationRepository.save(notification)

      // Send real-time notification via WebSocket
      await this.escrowGateway.sendNotificationToUser(notificationData.userId, {
        id: savedNotification.id,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data,
        createdAt: savedNotification.createdAt,
      })

      this.logger.log(`Notification sent to user ${notificationData.userId}: ${notificationData.title}`)
    }
  }
}
