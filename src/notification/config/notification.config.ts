import { registerAs } from "@nestjs/config"

export const notificationConfig = registerAs("notification", () => ({
  // Queue settings
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number.parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  // Email settings
  email: {
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL || "noreply@example.com",
    },
  },

  // SMS settings
  sms: {
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER,
    },
  },

  // Push notification settings
  push: {
    firebase: {
      serverKey: process.env.FIREBASE_SERVER_KEY,
      projectId: process.env.FIREBASE_PROJECT_ID,
    },
  },

  // Retry settings
  retry: {
    maxAttempts: Number.parseInt(process.env.NOTIFICATION_MAX_RETRIES, 10) || 3,
    backoffDelay: Number.parseInt(process.env.NOTIFICATION_BACKOFF_DELAY, 10) || 2000,
  },

  // Rate limiting
  rateLimit: {
    email: {
      maxPerMinute: Number.parseInt(process.env.EMAIL_RATE_LIMIT_PER_MINUTE, 10) || 100,
    },
    sms: {
      maxPerMinute: Number.parseInt(process.env.SMS_RATE_LIMIT_PER_MINUTE, 10) || 50,
    },
    push: {
      maxPerMinute: Number.parseInt(process.env.PUSH_RATE_LIMIT_PER_MINUTE, 10) || 200,
    },
  },
}))
