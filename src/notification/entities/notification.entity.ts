import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm"
import { NotificationTemplate } from "./notification-template.entity"
import { NotificationDeliveryLog } from "./notification-delivery-log.entity"
import { NotificationStatus } from "../enums/notification-status.enum"
import { NotificationType } from "../enums/notification-type.enum"

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  userId: string

  @Column({ type: "uuid", nullable: true })
  templateId: string

  @Column({ type: "enum", enum: NotificationType })
  type: NotificationType

  @Column()
  title: string

  @Column({ type: "text" })
  content: string

  @Column({ type: "json", nullable: true })
  data: Record<string, any>

  @Column({ type: "enum", enum: NotificationStatus, default: NotificationStatus.PENDING })
  status: NotificationStatus

  @Column({ type: "json", nullable: true })
  channels: string[]

  @Column({ type: "timestamp", nullable: true })
  scheduledAt: Date

  @Column({ type: "timestamp", nullable: true })
  sentAt: Date

  @Column({ type: "int", default: 0 })
  retryCount: number

  @Column({ type: "int", default: 3 })
  maxRetries: number

  @Column({ type: "text", nullable: true })
  errorMessage: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => NotificationTemplate, { nullable: true })
  @JoinColumn({ name: "templateId" })
  template: NotificationTemplate

  @OneToMany(
    () => NotificationDeliveryLog,
    (log) => log.notification,
  )
  deliveryLogs: NotificationDeliveryLog[]
}
