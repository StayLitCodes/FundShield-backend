import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import { DisputeStatus } from "../enums/dispute-status.enum"

@Entity("dispute_metrics")
@Index(["timestamp"])
@Index(["status", "timestamp"])
export class DisputeMetric {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  disputeId: string

  @Column({ type: "uuid" })
  escrowId: string

  @Column({ type: "uuid" })
  initiatorId: string

  @Column({ type: "enum", enum: DisputeStatus })
  status: DisputeStatus

  @Column()
  category: string

  @Column({ type: "int", nullable: true })
  resolutionTime: number

  @Column({ nullable: true })
  resolution: string

  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
  resolutionRate: number

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @Column({ type: "timestamp" })
  timestamp: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
