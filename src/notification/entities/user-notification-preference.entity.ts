import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from "typeorm"
import { NotificationType } from "../enums/notification-type.enum"

@Entity("user_notification_preferences")
@Unique(["userId", "notificationType"])
export class UserNotificationPreference {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  userId: string

  @Column({ type: "enum", enum: NotificationType })
  notificationType: NotificationType

  @Column({ default: true })
  emailEnabled: boolean

  @Column({ default: true })
  smsEnabled: boolean

  @Column({ default: true })
  pushEnabled: boolean

  @Column({ default: true })
  inAppEnabled: boolean

  @Column({ type: "json", nullable: true })
  customSettings: Record<string, any>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
