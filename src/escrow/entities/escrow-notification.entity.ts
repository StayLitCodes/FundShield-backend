import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm"
import { NotificationType } from "../enums/notification-type.enum"

@Entity("escrow_notifications")
@Index(["escrowId", "createdAt"])
export class EscrowNotification {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  escrowId: string

  @Column({ type: "uuid" })
  userId: string

  @Column({ type: "enum", enum: NotificationType })
  type: NotificationType

  @Column()
  title: string

  @Column({ type: "text" })
  message: string

  @Column({ type: "json", nullable: true })
  data: Record<string, any>

  @Column({ default: false })
  isRead: boolean

  @Column({ type: "timestamp", nullable: true })
  readAt: Date

  @Column({ default: false })
  isEmailSent: boolean

  @Column({ default: false })
  isPushSent: boolean

  @CreateDateColumn()
  createdAt: Date
}
