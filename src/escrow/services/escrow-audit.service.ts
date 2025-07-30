import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { EscrowAuditLog } from "../entities/escrow-audit-log.entity"
import type { AuditAction } from "../enums/audit-action.enum"

@Injectable()
export class EscrowAuditService {
  constructor(private auditLogRepository: Repository<EscrowAuditLog>) {}

  async logAction(
    escrowId: string,
    action: AuditAction,
    performedBy: string,
    details: {
      description?: string
      oldValues?: Record<string, any>
      newValues?: Record<string, any>
      metadata?: Record<string, any>
      ipAddress?: string
      userAgent?: string
    },
  ): Promise<EscrowAuditLog> {
    const auditLog = this.auditLogRepository.create({
      escrowId,
      action,
      performedBy,
      description: details.description,
      oldValues: details.oldValues,
      newValues: details.newValues,
      metadata: details.metadata,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
    })

    return this.auditLogRepository.save(auditLog)
  }

  async getEscrowHistory(escrowId: string): Promise<EscrowAuditLog[]> {
    return this.auditLogRepository.find({
      where: { escrowId },
      order: { createdAt: "ASC" },
    })
  }

  async getUserAuditHistory(userId: string, limit = 100): Promise<EscrowAuditLog[]> {
    return this.auditLogRepository.find({
      where: { performedBy: userId },
      order: { createdAt: "DESC" },
      take: limit,
    })
  }

  async getAuditStatistics(escrowId?: string): Promise<Record<string, any>> {
    const queryBuilder = this.auditLogRepository.createQueryBuilder("audit")

    if (escrowId) {
      queryBuilder.where("audit.escrowId = :escrowId", { escrowId })
    }

    const [total, actionCounts] = await Promise.all([
      queryBuilder.getCount(),
      queryBuilder.select("audit.action", "action").addSelect("COUNT(*)", "count").groupBy("audit.action").getRawMany(),
    ])

    const actionStats = actionCounts.reduce((acc, item) => {
      acc[item.action] = Number(item.count)
      return acc
    }, {})

    return {
      total,
      actionStats,
    }
  }
}
