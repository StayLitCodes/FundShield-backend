import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { Notification } from "./notification.entity"
import { DeliveryStatus } from "../enums/delivery-status.enum"

@Entity("notification_delivery_logs")
export class NotificationDeliveryLog {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  notificationId: string

  @Column()
  channel: string

  @Column()
  recipient: string

  @Column({ type: "enum", enum: DeliveryStatus })
  status: DeliveryStatus

  @Column({ type: "text", nullable: true })
  errorMessage: string

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @Column({ type: "timestamp", nullable: true })
  sentAt: Date

  @Column({ type: "timestamp", nullable: true })
  deliveredAt: Date

  @CreateDateColumn()
  createdAt: Date

  @ManyToOne(
    () => Notification,
    (notification) => notification.deliveryLogs,
  )
  @JoinColumn({ name: "notificationId" })
  notification: Notification
}
