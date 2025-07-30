import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"
import { NotificationType } from "../enums/notification-type.enum"
import { NotificationStatus } from "../enums/notification-status.enum"

@Entity("notification_history")
export class NotificationHistory {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  userId: string

  @Column({ type: "uuid" })
  notificationId: string

  @Column({ type: "enum", enum: NotificationType })
  type: NotificationType

  @Column()
  title: string

  @Column({ type: "text" })
  content: string

  @Column({ type: "enum", enum: NotificationStatus })
  status: NotificationStatus

  @Column({ type: "json", nullable: true })
  channels: string[]

  @Column({ type: "timestamp", nullable: true })
  readAt: Date

  @CreateDateColumn()
  createdAt: Date
}
