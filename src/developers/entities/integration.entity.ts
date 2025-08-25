import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum IntegrationType {
  PRICE_FEED = "price_feed",
  KYC_PROVIDER = "kyc_provider",
  PAYMENT_GATEWAY = "payment_gateway",
}

export enum IntegrationStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ERROR = "error",
  PENDING = "pending",
}

@Entity("integrations")
@Index(["type", "status"])
@Index(["developerId", "type"])
export class Integration {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "developer_id" })
  developerId: string

  @Column({
    type: "enum",
    enum: IntegrationType,
  })
  type: IntegrationType

  @Column()
  name: string

  @Column()
  provider: string

  @Column({ type: "jsonb" })
  config: Record<string, any>

  @Column({ type: "jsonb", nullable: true })
  credentials: Record<string, any>

  @Column({
    type: "enum",
    enum: IntegrationStatus,
    default: IntegrationStatus.PENDING,
  })
  status: IntegrationStatus

  @Column({ name: "api_endpoint" })
  apiEndpoint: string

  @Column({ name: "rate_limit", default: 100 })
  rateLimit: number

  @Column({ name: "last_used", type: "timestamp", nullable: true })
  lastUsed: Date

  @Column({ name: "error_count", default: 0 })
  errorCount: number

  @Column({ name: "last_error", nullable: true })
  lastError: string

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date
}
