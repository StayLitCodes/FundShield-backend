import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import { TransactionStatus } from "../enums/transaction-status.enum"

@Entity("transaction_metrics")
@Index(["timestamp"])
@Index(["status", "timestamp"])
export class TransactionMetric {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  transactionId: string

  @Column({ type: "uuid" })
  userId: string

  @Column({ type: "decimal", precision: 15, scale: 4 })
  amount: number

  @Column({ default: "USD" })
  currency: string

  @Column({ type: "enum", enum: TransactionStatus })
  status: TransactionStatus

  @Column()
  type: string

  @Column({ type: "decimal", precision: 15, scale: 4, nullable: true })
  fee: number

  @Column({ type: "int", nullable: true })
  processingTime: number

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @Column({ type: "timestamp" })
  timestamp: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
