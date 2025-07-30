import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import { EscrowStatus } from "../enums/escrow-status.enum"

@Entity("escrow_metrics")
@Index(["timestamp"])
@Index(["status", "timestamp"])
export class EscrowMetric {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  escrowId: string

  @Column({ type: "uuid" })
  buyerId: string

  @Column({ type: "uuid" })
  sellerId: string

  @Column({ type: "decimal", precision: 15, scale: 4 })
  amount: number

  @Column({ default: "USD" })
  currency: string

  @Column({ type: "enum", enum: EscrowStatus })
  status: EscrowStatus

  @Column({ type: "int", nullable: true })
  completionTime: number

  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
  successRate: number

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @Column({ type: "timestamp" })
  timestamp: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
