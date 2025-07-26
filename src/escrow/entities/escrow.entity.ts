import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { EscrowStatus } from "../enums/escrow-status.enum"
import { EscrowType } from "../enums/escrow-type.enum"
import { EscrowMilestone } from "./escrow-milestone.entity"
import { EscrowTransaction } from "./escrow-transaction.entity"
import { EscrowParticipant } from "./escrow-participant.entity"
import { EscrowCondition } from "./escrow-condition.entity"
import { EscrowAuditLog } from "./escrow-audit-log.entity"
import { EscrowTemplate } from "./escrow-template.entity"
import { EscrowDispute } from "./escrow-dispute.entity"

@Entity("escrows")
@Index(["status", "createdAt"])
@Index(["buyerId", "sellerId"])
export class Escrow {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ unique: true })
  escrowNumber: string

  @Column()
  title: string

  @Column({ type: "text", nullable: true })
  description: string

  @Column({ type: "enum", enum: EscrowType })
  type: EscrowType

  @Column({ type: "enum", enum: EscrowStatus, default: EscrowStatus.CREATED })
  status: EscrowStatus

  @Column({ type: "uuid" })
  buyerId: string

  @Column({ type: "uuid" })
  sellerId: string

  @Column({ type: "decimal", precision: 15, scale: 4 })
  totalAmount: number

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  lockedAmount: number

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  releasedAmount: number

  @Column({ default: "USD" })
  currency: string

  @Column({ type: "decimal", precision: 5, scale: 4, default: 0.025 })
  feePercentage: number

  @Column({ type: "decimal", precision: 15, scale: 4, default: 0 })
  feeAmount: number

  @Column({ type: "uuid", nullable: true })
  templateId: string

  @Column({ type: "json", nullable: true })
  terms: Record<string, any>

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @Column({ type: "timestamp", nullable: true })
  fundingDeadline: Date

  @Column({ type: "timestamp", nullable: true })
  completionDeadline: Date

  @Column({ type: "timestamp", nullable: true })
  fundedAt: Date

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date

  @Column({ type: "timestamp", nullable: true })
  cancelledAt: Date

  @Column({ nullable: true })
  smartContractAddress: string

  @Column({ nullable: true })
  blockchainTxHash: string

  @Column({ type: "json", nullable: true })
  smartContractData: Record<string, any>

  @Column({ default: false })
  isMultiMilestone: boolean

  @Column({ default: false })
  autoRelease: boolean

  @Column({ type: "int", default: 0 })
  autoReleaseDelayHours: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(
    () => EscrowMilestone,
    (milestone) => milestone.escrow,
    { cascade: true },
  )
  milestones: EscrowMilestone[]

  @OneToMany(
    () => EscrowTransaction,
    (transaction) => transaction.escrow,
  )
  transactions: EscrowTransaction[]

  @OneToMany(
    () => EscrowParticipant,
    (participant) => participant.escrow,
    { cascade: true },
  )
  participants: EscrowParticipant[]

  @OneToMany(
    () => EscrowCondition,
    (condition) => condition.escrow,
    { cascade: true },
  )
  conditions: EscrowCondition[]

  @OneToMany(
    () => EscrowAuditLog,
    (auditLog) => auditLog.escrow,
  )
  auditLogs: EscrowAuditLog[]

  @OneToMany(
    () => EscrowDispute,
    (dispute) => dispute.escrow,
  )
  disputes: EscrowDispute[]

  @ManyToOne(() => EscrowTemplate, { nullable: true })
  @JoinColumn({ name: "templateId" })
  template: EscrowTemplate
}
