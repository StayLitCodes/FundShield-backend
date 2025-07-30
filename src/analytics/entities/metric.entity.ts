import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import { MetricType } from "../enums/metric-type.enum"

@Entity("metrics")
@Index(["type", "timestamp"])
@Index(["entityId", "type"])
export class Metric {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "enum", enum: MetricType })
  type: MetricType

  @Column()
  name: string

  @Column({ type: "decimal", precision: 15, scale: 4 })
  value: number

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @Column({ type: "uuid", nullable: true })
  entityId: string

  @Column({ nullable: true })
  entityType: string

  @Column({ type: "uuid", nullable: true })
  userId: string

  @Column({ type: "timestamp" })
  timestamp: Date

  @Column({ nullable: true })
  source: string

  @Column({ type: "json", nullable: true })
  tags: string[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
