import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { TransactionType } from "../enums/transaction-type.enum"
import { TransactionStatus } from "../enums/transaction-status.enum"
import { Escrow } from "./escrow.entity"
import { EscrowMilestone } from "./escrow-milestone.entity"

@Entity("escrow_transactions")
@Index(["escrowId", "type"])
@Index(["status", "createdAt"])
export class EscrowTransaction {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  escrowId: string

  @Column({ type: "uuid", nullable: true })
  milestoneId: string

  @Column({ type: "enum", enum: TransactionType })
  type: TransactionType

  @Column({ type: "enum", enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus

  @Column({ type: "decimal", precision: 15, scale: 4 })
  amount: number

  @Column({ default: "USD" })
  currency: string

  @Column({ type: "uuid" })
  initiatedBy: string

  @Column({ type: "uuid", nullable: true })
  approvedBy: string

  @Column({ type: "text", nullable: true })
  description: string

  @Column({ nullable: true })
  externalTransactionId: string

  @Column({ nullable: true })
  blockchainTxHash: string

  @Column({ type: "json", nullable: true })
  blockchainData: Record<string, any>

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @Column({ type: "timestamp", nullable: true })
  processedAt: Date

  @Column({ type: "timestamp", nullable: true })
  confirmedAt: Date

  @Column({ type: "text", nullable: true })
  failureReason: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(
    () => Escrow,
    (escrow) => escrow.transactions,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "escrowId" })
  escrow: Escrow

  @ManyToOne(
    () => EscrowMilestone,
    (milestone) => milestone.transactions,
    { nullable: true },
  )
  @JoinColumn({ name: "milestoneId" })
  milestone: EscrowMilestone
}
