import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

@Entity("performance_metrics")
@Index(["timestamp"])
@Index(["endpoint", "timestamp"])
export class PerformanceMetric {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  endpoint: string

  @Column()
  method: string

  @Column({ type: "int" })
  responseTime: number

  @Column({ type: "int" })
  statusCode: number

  @Column({ type: "int", nullable: true })
  memoryUsage: number

  @Column({ type: "int", nullable: true })
  cpuUsage: number

  @Column({ type: "uuid", nullable: true })
  userId: string

  @Column({ nullable: true })
  userAgent: string

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @Column({ type: "timestamp" })
  timestamp: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
