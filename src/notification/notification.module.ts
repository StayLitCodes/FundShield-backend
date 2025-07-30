import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { BullModule } from "@nestjs/bull"
import { ConfigModule } from "@nestjs/config"

// Entities
import { Notification } from "./entities/notification.entity"
import { NotificationTemplate } from "./entities/notification-template.entity"
import { UserNotificationPreference } from "./entities/user-notification-preference.entity"
import { NotificationDeliveryLog } from "./entities/notification-delivery-log.entity"
import { NotificationHistory } from "./entities/notification-history.entity"

// Services
import { NotificationService } from "./services/notification.service"
import { EmailService } from "./services/email.service"
import { SmsService } from "./services/sms.service"
import { PushNotificationService } from "./services/push-notification.service"
import { InAppNotificationService } from "./services/in-app-notification.service"
import { TemplateService } from "./services/template.service"
import { UserPreferenceService } from "./services/user-preference.service"

// Controllers
import { NotificationController } from "./controllers/notification.controller"
import { NotificationTemplateController } from "./controllers/notification-template.controller"
import { UserPreferenceController } from "./controllers/user-preference.controller"

// Gateways
import { NotificationGateway } from "./gateways/notification.gateway"

// Processors
import { EmailProcessor } from "./processors/email.processor"
import { SmsProcessor } from "./processors/sms.processor"
import { PushProcessor } from "./processors/push.processor"
import { InAppProcessor } from "./processors/in-app.processor"

// Providers
import { SendGridProvider } from "./providers/sendgrid.provider"
import { TwilioProvider } from "./providers/twilio.provider"
import { FirebaseProvider } from "./providers/firebase.provider"

// Config
import { notificationConfig } from "./config/notification.config"

@Module({
  imports: [
    ConfigModule.forFeature(notificationConfig),
    TypeOrmModule.forFeature([
      Notification,
      NotificationTemplate,
      UserNotificationPreference,
      NotificationDeliveryLog,
      NotificationHistory,
    ]),
    BullModule.registerQueue(
      { name: "email-queue" },
      { name: "sms-queue" },
      { name: "push-queue" },
      { name: "in-app-queue" },
    ),
  ],
  controllers: [NotificationController, NotificationTemplateController, UserPreferenceController],
  providers: [
    NotificationService,
    EmailService,
    SmsService,
    PushNotificationService,
    InAppNotificationService,
    TemplateService,
    UserPreferenceService,
    NotificationGateway,
    EmailProcessor,
    SmsProcessor,
    PushProcessor,
    InAppProcessor,
    SendGridProvider,
    TwilioProvider,
    FirebaseProvider,
  ],
  exports: [
    NotificationService,
    EmailService,
    SmsService,
    PushNotificationService,
    InAppNotificationService,
    TemplateService,
    UserPreferenceService,
  ],
})
export class NotificationModule {}
