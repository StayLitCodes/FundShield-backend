import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

@Entity("revenue_metrics")
@Index(["timestamp"])
@Index(["revenueType", "timestamp"])
export class RevenueMetric {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "decimal", precision: 15, scale: 4 })
  amount: number

  @Column({ default: "USD" })
  currency: string

  @Column()
  revenueType: string

  @Column({ type: "uuid", nullable: true })
  sourceId: string

  @Column({ nullable: true })
  sourceType: string

  @Column({ type: "decimal", precision: 15, scale: 4, nullable: true })
  fee: number

  @Column({ type: "decimal", precision: 15, scale: 4, nullable: true })
  netRevenue: number

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @Column({ type: "timestamp" })
  timestamp: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
