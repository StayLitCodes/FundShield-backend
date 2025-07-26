import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { UserNotificationPreference } from "../entities/user-notification-preference.entity"
import type { CreateUserPreferenceDto, UpdateUserPreferenceDto } from "../dto/user-preference.dto"
import type { NotificationType } from "../enums/notification-type.enum"

@Injectable()
export class UserPreferenceService {
  constructor(private preferenceRepository: Repository<UserNotificationPreference>) {}

  async createOrUpdatePreference(
    userId: string,
    notificationType: NotificationType,
    preferenceDto: CreateUserPreferenceDto | UpdateUserPreferenceDto,
  ): Promise<UserNotificationPreference> {
    const existingPreference = await this.preferenceRepository.findOne({
      where: { userId, notificationType },
    })

    if (existingPreference) {
      Object.assign(existingPreference, preferenceDto)
      return this.preferenceRepository.save(existingPreference)
    }

    const newPreference = this.preferenceRepository.create({
      userId,
      notificationType,
      ...preferenceDto,
    })

    return this.preferenceRepository.save(newPreference)
  }

  async getUserPreferences(userId: string): Promise<UserNotificationPreference[]> {
    return this.preferenceRepository.find({ where: { userId } })
  }

  async getUserPreferenceByType(
    userId: string,
    notificationType: NotificationType,
  ): Promise<UserNotificationPreference | null> {
    return this.preferenceRepository.findOne({
      where: { userId, notificationType },
    })
  }

  async updatePreference(
    userId: string,
    notificationType: NotificationType,
    updateDto: UpdateUserPreferenceDto,
  ): Promise<UserNotificationPreference> {
    const preference = await this.getUserPreferenceByType(userId, notificationType)

    if (!preference) {
      return this.createOrUpdatePreference(userId, notificationType, updateDto)
    }

    Object.assign(preference, updateDto)
    return this.preferenceRepository.save(preference)
  }

  async deletePreference(userId: string, notificationType: NotificationType): Promise<void> {
    await this.preferenceRepository.delete({ userId, notificationType })
  }

  async deleteAllUserPreferences(userId: string): Promise<void> {
    await this.preferenceRepository.delete({ userId })
  }
}
