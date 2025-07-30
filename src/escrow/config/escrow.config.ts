import { registerAs } from "@nestjs/config"

export const escrowConfig = registerAs("escrow", () => ({
  // Default settings
  defaults: {
    feePercentage: Number.parseFloat(process.env.DEFAULT_ESCROW_FEE_PERCENTAGE) || 0.025,
    currency: process.env.DEFAULT_CURRENCY || "USD",
    autoReleaseDelayHours: Number.parseInt(process.env.DEFAULT_AUTO_RELEASE_DELAY_HOURS, 10) || 72,
    fundingDeadlineDays: Number.parseInt(process.env.DEFAULT_FUNDING_DEADLINE_DAYS, 10) || 7,
    completionDeadlineDays: Number.parseInt(process.env.DEFAULT_COMPLETION_DEADLINE_DAYS, 10) || 30,
  },

  // Blockchain settings
  blockchain: {
    network: process.env.BLOCKCHAIN_NETWORK || "ethereum",
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL,
    privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY,
    contractAddress: process.env.ESCROW_CONTRACT_ADDRESS,
    gasLimit: Number.parseInt(process.env.BLOCKCHAIN_GAS_LIMIT, 10) || 500000,
    gasPrice: process.env.BLOCKCHAIN_GAS_PRICE || "20000000000", // 20 gwei
  },

  // Queue settings
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number.parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  // Notification settings
  notifications: {
    enableEmail: process.env.ENABLE_EMAIL_NOTIFICATIONS !== "false",
    enablePush: process.env.ENABLE_PUSH_NOTIFICATIONS !== "false",
    enableWebSocket: process.env.ENABLE_WEBSOCKET_NOTIFICATIONS !== "false",
  },

  // Security settings
  security: {
    maxEscrowAmount: Number.parseFloat(process.env.MAX_ESCROW_AMOUNT) || 1000000,
    minEscrowAmount: Number.parseFloat(process.env.MIN_ESCROW_AMOUNT) || 1,
    requireKyc: process.env.REQUIRE_KYC === "true",
    requireTwoFactor: process.env.REQUIRE_TWO_FACTOR === "true",
  },

  // Milestone settings
  milestones: {
    maxMilestones: Number.parseInt(process.env.MAX_MILESTONES_PER_ESCROW, 10) || 10,
    autoApprovalEnabled: process.env.MILESTONE_AUTO_APPROVAL_ENABLED !== "false",
    defaultAutoApprovalDelayHours: Number.parseInt(process.env.DEFAULT_MILESTONE_AUTO_APPROVAL_DELAY, 10) || 72,
  },

  // Audit settings
  audit: {
    retentionDays: Number.parseInt(process.env.AUDIT_RETENTION_DAYS, 10) || 2555, // 7 years
    enableDetailedLogging: process.env.ENABLE_DETAILED_AUDIT_LOGGING !== "false",
  },

  // Performance settings
  performance: {
    bulkOperationBatchSize: Number.parseInt(process.env.BULK_OPERATION_BATCH_SIZE, 10) || 100,
    cacheTimeout: Number.parseInt(process.env.ESCROW_CACHE_TIMEOUT, 10) || 300, // 5 minutes
  },
}))
