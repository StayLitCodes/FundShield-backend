import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { Notification } from "./notification.entity"
import { NotificationType } from "../enums/notification-type.enum"

@Entity("notification_templates")
export class NotificationTemplate {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ unique: true })
  name: string

  @Column()
  subject: string

  @Column({ type: "text" })
  content: string

  @Column({ type: "text", nullable: true })
  htmlContent: string

  @Column({ type: "enum", enum: NotificationType })
  type: NotificationType

  @Column({ type: "json", nullable: true })
  variables: string[]

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @Column({ default: true })
  isActive: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(
    () => Notification,
    (notification) => notification.template,
  )
  notifications: Notification[]
}
