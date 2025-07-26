import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from "typeorm"
import { MilestoneStatus } from "../enums/milestone-status.enum"
import { Escrow } from "./escrow.entity"
import { EscrowTransaction } from "./escrow-transaction.entity"

@Entity("escrow_milestones")
@Index(["escrowId", "order"])
export class EscrowMilestone {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  escrowId: string

  @Column()
  title: string

  @Column({ type: "text", nullable: true })
  description: string

  @Column({ type: "int" })
  order: number

  @Column({ type: "enum", enum: MilestoneStatus, default: MilestoneStatus.PENDING })
  status: MilestoneStatus

  @Column({ type: "decimal", precision: 15, scale: 4 })
  amount: number

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  percentage: number

  @Column({ type: "json", nullable: true })
  requirements: Array<{
    id: string
    description: string
    type: string
    completed: boolean
    completedAt?: Date
    completedBy?: string
  }>

  @Column({ type: "json", nullable: true })
  deliverables: Array<{
    id: string
    name: string
    description: string
    fileUrl?: string
    submittedAt?: Date
    approved: boolean
  }>

  @Column({ type: "timestamp", nullable: true })
  dueDate: Date

  @Column({ type: "timestamp", nullable: true })
  startedAt: Date

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date

  @Column({ type: "timestamp", nullable: true })
  approvedAt: Date

  @Column({ type: "uuid", nullable: true })
  approvedBy: string

  @Column({ type: "text", nullable: true })
  approvalNotes: string

  @Column({ default: false })
  autoApprove: boolean

  @Column({ type: "int", default: 0 })
  autoApproveDelayHours: number

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(
    () => Escrow,
    (escrow) => escrow.milestones,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "escrowId" })
  escrow: Escrow

  @OneToMany(
    () => EscrowTransaction,
    (transaction) => transaction.milestone,
  )
  transactions: EscrowTransaction[]
}
