import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

@Entity("kpi_metrics")
@Index(["name", "timestamp"])
export class KpiMetric {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  name: string

  @Column({ type: "decimal", precision: 15, scale: 4 })
  value: number

  @Column({ type: "decimal", precision: 15, scale: 4, nullable: true })
  target: number

  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
  variance: number

  @Column()
  unit: string

  @Column()
  category: string

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @Column({ type: "timestamp" })
  timestamp: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
