import { Controller, Post, Get, Param, Body, Query, Patch } from "@nestjs/common"
import type { NotificationService } from "../services/notification.service"
import type { CreateNotificationDto } from "../dto/create-notification.dto"
import type { BulkNotificationDto } from "../dto/bulk-notification.dto"
import type { Notification } from "../entities/notification.entity"
import type { NotificationHistory } from "../entities/notification-history.entity"

@Controller("notifications")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  async createNotification(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    return this.notificationService.createNotification(createNotificationDto)
  }

  @Post("bulk")
  async createBulkNotifications(bulkNotificationDto: BulkNotificationDto): Promise<Notification[]> {
    return this.notificationService.createBulkNotifications(bulkNotificationDto)
  }

  @Get()
  async getNotifications(@Query('page') page = 1, @Query('limit') limit = 20): Promise<Notification[]> {
    return this.notificationService.getNotifications(page, limit)
  }

  @Get(':id')
  async getNotificationById(@Param('id') id: string): Promise<Notification> {
    return this.notificationService.getNotificationById(id);
  }

  @Get("user/:userId/history")
  async getUserNotificationHistory(
    @Param('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<NotificationHistory[]> {
    return this.notificationService.getNotificationHistory(userId, page, limit)
  }

  @Patch(":id/read")
  async markAsRead(@Param('id') notificationId: string, @Body('userId') userId: string): Promise<void> {
    return this.notificationService.markAsRead(notificationId, userId)
  }
}
