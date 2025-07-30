import { registerAs } from "@nestjs/config"

export const analyticsConfig = registerAs("analytics", () => ({
  // Database settings
  database: {
    retentionDays: Number.parseInt(process.env.ANALYTICS_RETENTION_DAYS, 10) || 90,
    batchSize: Number.parseInt(process.env.ANALYTICS_BATCH_SIZE, 10) || 1000,
  },

  // Queue settings
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number.parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  // Export settings
  export: {
    directory: process.env.EXPORT_DIRECTORY || "./exports",
    maxFileSize: Number.parseInt(process.env.MAX_EXPORT_FILE_SIZE, 10) || 50 * 1024 * 1024, // 50MB
    cleanupDays: Number.parseInt(process.env.EXPORT_CLEANUP_DAYS, 10) || 7,
  },

  // Real-time settings
  realtime: {
    metricsWindow: Number.parseInt(process.env.REALTIME_METRICS_WINDOW, 10) || 60, // minutes
    broadcastInterval: Number.parseInt(process.env.REALTIME_BROADCAST_INTERVAL, 10) || 5000, // ms
  },

  // KPI settings
  kpi: {
    calculationInterval: process.env.KPI_CALCULATION_INTERVAL || "0 * * * *", // Every hour
    targets: {
      dailyTransactionVolume: Number.parseInt(process.env.KPI_DAILY_TRANSACTION_VOLUME, 10) || 100000,
      dailyActiveUsers: Number.parseInt(process.env.KPI_DAILY_ACTIVE_USERS, 10) || 1000,
      dailyRevenue: Number.parseInt(process.env.KPI_DAILY_REVENUE, 10) || 10000,
      avgResponseTime: Number.parseInt(process.env.KPI_AVG_RESPONSE_TIME, 10) || 200,
    },
  },

  // Performance settings
  performance: {
    enableInterceptors: process.env.ENABLE_PERFORMANCE_INTERCEPTORS !== "false",
    sampleRate: Number.parseFloat(process.env.PERFORMANCE_SAMPLE_RATE) || 1.0, // 100% sampling
  },

  // Aggregation settings
  aggregation: {
    intervals: ["minute", "hour", "day", "week", "month"],
    defaultInterval: process.env.DEFAULT_AGGREGATION_INTERVAL || "hour",
  },
}))
