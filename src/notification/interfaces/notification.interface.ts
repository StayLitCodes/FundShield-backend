import type { NotificationType } from "../enums/notification-type.enum"
import type { NotificationStatus } from "../enums/notification-status.enum"

export interface INotification {
  id: string
  userId: string
  templateId?: string
  type: NotificationType
  title: string
  content: string
  data?: Record<string, any>
  status: NotificationStatus
  channels: string[]
  scheduledAt?: Date
  sentAt?: Date
  retryCount: number
  maxRetries: number
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
}

export interface INotificationProvider {
  send(notification: INotification): Promise<boolean>
  sendBulk(notifications: INotification[]): Promise<boolean>
}

export interface ITemplateData {
  [key: string]: any
}

export interface INotificationJob {
  notificationId: string
  userId: string
  title: string
  content: string
  data?: Record<string, any>
  templateId?: string
}
