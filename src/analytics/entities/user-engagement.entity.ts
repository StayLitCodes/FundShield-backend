import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import { EngagementType } from "../enums/engagement-type.enum"

@Entity("user_engagement")
@Index(["userId", "timestamp"])
@Index(["type", "timestamp"])
export class UserEngagement {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  userId: string

  @Column({ type: "enum", enum: EngagementType })
  type: EngagementType

  @Column()
  action: string

  @Column({ nullable: true })
  page: string

  @Column({ nullable: true })
  feature: string

  @Column({ type: "int", default: 1 })
  duration: number

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @Column({ type: "timestamp" })
  timestamp: Date

  @Column({ nullable: true })
  sessionId: string

  @Column({ nullable: true })
  userAgent: string

  @Column({ nullable: true })
  ipAddress: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
