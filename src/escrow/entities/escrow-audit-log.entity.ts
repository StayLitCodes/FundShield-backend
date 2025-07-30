import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { AuditAction } from "../enums/audit-action.enum"
import { Escrow } from "./escrow.entity"

@Entity("escrow_audit_logs")
@Index(["escrowId", "createdAt"])
export class EscrowAuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  escrowId: string

  @Column({ type: "enum", enum: AuditAction })
  action: AuditAction

  @Column({ type: "uuid" })
  performedBy: string

  @Column({ type: "text", nullable: true })
  description: string

  @Column({ type: "json", nullable: true })
  oldValues: Record<string, any>

  @Column({ type: "json", nullable: true })
  newValues: Record<string, any>

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @Column({ nullable: true })
  ipAddress: string

  @Column({ nullable: true })
  userAgent: string

  @CreateDateColumn()
  createdAt: Date

  @ManyToOne(
    () => Escrow,
    (escrow) => escrow.auditLogs,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "escrowId" })
  escrow: Escrow
}
