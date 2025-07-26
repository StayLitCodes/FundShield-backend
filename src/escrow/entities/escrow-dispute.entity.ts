import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm"
import { DisputeStatus } from "../enums/dispute-status.enum"
import { DisputeType } from "../enums/dispute-type.enum"
import { Escrow } from "./escrow.entity"

@Entity("escrow_disputes")
export class EscrowDispute {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  escrowId: string

  @Column({ type: "enum", enum: DisputeType })
  type: DisputeType

  @Column({ type: "enum", enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus

  @Column({ type: "uuid" })
  initiatedBy: string

  @Column()
  title: string

  @Column({ type: "text" })
  description: string

  @Column({ type: "json", nullable: true })
  evidence: Array<{
    id: string
    type: string
    description: string
    fileUrl?: string
    submittedAt: Date
    submittedBy: string
  }>

  @Column({ type: "uuid", nullable: true })
  assignedTo: string

  @Column({ type: "text", nullable: true })
  resolution: string

  @Column({ type: "timestamp", nullable: true })
  resolvedAt: Date

  @Column({ type: "uuid", nullable: true })
  resolvedBy: string

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(
    () => Escrow,
    (escrow) => escrow.disputes,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "escrowId" })
  escrow: Escrow
}
