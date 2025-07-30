import { Controller, Post, Get, Put, Delete, Body } from "@nestjs/common"
import type { UserPreferenceService } from "../services/user-preference.service"
import type { CreateUserPreferenceDto, UpdateUserPreferenceDto } from "../dto/user-preference.dto"
import type { UserNotificationPreference } from "../entities/user-notification-preference.entity"
import type { NotificationType } from "../enums/notification-type.enum"

@Controller("user-preferences")
export class UserPreferenceController {
  constructor(private readonly userPreferenceService: UserPreferenceService) {}

  @Post(":userId/:notificationType")
  async createOrUpdatePreference(
    userId: string,
    notificationType: NotificationType,
    @Body() preferenceDto: CreateUserPreferenceDto,
  ): Promise<UserNotificationPreference> {
    return this.userPreferenceService.createOrUpdatePreference(userId, notificationType, preferenceDto)
  }

  @Get(":userId")
  async getUserPreferences(userId: string): Promise<UserNotificationPreference[]> {
    return this.userPreferenceService.getUserPreferences(userId)
  }

  @Get(":userId/:notificationType")
  async getUserPreferenceByType(
    userId: string,
    notificationType: NotificationType,
  ): Promise<UserNotificationPreference | null> {
    return this.userPreferenceService.getUserPreferenceByType(userId, notificationType)
  }

  @Put(":userId/:notificationType")
  async updatePreference(
    userId: string,
    notificationType: NotificationType,
    @Body() updateDto: UpdateUserPreferenceDto,
  ): Promise<UserNotificationPreference> {
    return this.userPreferenceService.updatePreference(userId, notificationType, updateDto)
  }

  @Delete(":userId/:notificationType")
  async deletePreference(userId: string, notificationType: NotificationType): Promise<void> {
    return this.userPreferenceService.deletePreference(userId, notificationType)
  }

  @Delete(":userId")
  async deleteAllUserPreferences(userId: string): Promise<void> {
    return this.userPreferenceService.deleteAllUserPreferences(userId)
  }
}
