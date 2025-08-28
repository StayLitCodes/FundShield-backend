import { MigrationInterface, QueryRunner } from 'typeorm';

export class FullSchema1693050000001 implements MigrationInterface {
  name = 'FullSchema1693050000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Users and related
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "username" varchar(100) NOT NULL,
        "email" varchar(255) NOT NULL,
        "password" varchar(255) NOT NULL,
        "role" varchar(50) NOT NULL,
        "status" varchar(50) NOT NULL,
        "emailVerified" boolean DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email");`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_username" ON "users" ("username");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_profiles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid UNIQUE,
        "firstName" varchar(100),
        "lastName" varchar(100),
        "profilePictureUrl" varchar(255),
        "documents" jsonb,
        "bio" text,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_userprofile_user FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_kyc" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid UNIQUE,
        "status" varchar(50),
        "documents" jsonb,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_kyc_user FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_preferences" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid UNIQUE,
        "preferences" jsonb,
        CONSTRAINT fk_pref_user FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_activities" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "action" varchar(255),
        "metadata" jsonb,
        "createdAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_activity_user FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);

    // Escrow and related
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "escrows" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "escrowNumber" varchar(255) NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "type" varchar(50) NOT NULL,
        "status" varchar(50) NOT NULL,
        "buyerId" uuid NOT NULL,
        "sellerId" uuid NOT NULL,
        "totalAmount" numeric(15,4) NOT NULL,
        "lockedAmount" numeric(15,4) DEFAULT 0,
        "releasedAmount" numeric(15,4) DEFAULT 0,
        "currency" varchar(10) DEFAULT 'USD',
        "feePercentage" numeric(5,4) DEFAULT 0,
        "feeAmount" numeric(15,4) DEFAULT 0,
        "templateId" uuid,
        "terms" jsonb,
        "metadata" jsonb,
        "fundingDeadline" TIMESTAMP,
        "completionDeadline" TIMESTAMP,
        "fundedAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "cancelledAt" TIMESTAMP,
        "smartContractAddress" varchar(255),
        "blockchainTxHash" varchar(255),
        "smartContractData" jsonb,
        "isMultiMilestone" boolean DEFAULT false,
        "autoRelease" boolean DEFAULT false,
        "autoReleaseDelayHours" int DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_escrow_buyer FOREIGN KEY ("buyerId") REFERENCES "users" ("id"),
        CONSTRAINT fk_escrow_seller FOREIGN KEY ("sellerId") REFERENCES "users" ("id")
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_escrows_number" ON "escrows" ("escrowNumber");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_escrows_buyer_seller" ON "escrows" ("buyerId", "sellerId");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "escrow_templates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(255),
        "description" text,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "escrow_milestones" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "escrowId" uuid NOT NULL,
        "title" varchar(255),
        "description" text,
        "amount" numeric(15,4) NOT NULL,
        "dueDate" TIMESTAMP,
        "status" varchar(50),
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_milestone_escrow FOREIGN KEY ("escrowId") REFERENCES "escrows" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "escrow_participants" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "escrowId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" varchar(50),
        CONSTRAINT fk_participant_escrow FOREIGN KEY ("escrowId") REFERENCES "escrows" ("id") ON DELETE CASCADE,
        CONSTRAINT fk_participant_user FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "escrow_conditions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "escrowId" uuid NOT NULL,
        "conditionData" jsonb,
        CONSTRAINT fk_condition_escrow FOREIGN KEY ("escrowId") REFERENCES "escrows" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "escrow_audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "escrowId" uuid NOT NULL,
        "action" varchar(255),
        "metadata" jsonb,
        "createdAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_audit_escrow FOREIGN KEY ("escrowId") REFERENCES "escrows" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "escrow_transactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "escrowId" uuid,
        "transactionId" uuid,
        "type" varchar(100),
        "amount" numeric(36,18),
        "createdAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_escrowtx_escrow FOREIGN KEY ("escrowId") REFERENCES "escrows" ("id") ON DELETE CASCADE
      );
    `);

    // Transactions and saga steps
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "sagaId" uuid,
        "userId" uuid NOT NULL,
        "transaction_type" varchar(100) NOT NULL,
        "status" varchar(100) NOT NULL,
        "transaction_hash" varchar(255),
        "block_number" bigint,
        "contract_address" varchar(255),
        "amount" numeric(36,18) NOT NULL,
        "token_address" varchar(255),
        "from_address" varchar(255),
        "to_address" varchar(255),
        "gas_fee" numeric(36,18),
        "retry_count" int DEFAULT 0,
        "max_retries" int DEFAULT 3,
        "error_message" text,
        "metadata" jsonb,
        "idempotency_key" varchar(255) UNIQUE,
        "processed_at" TIMESTAMP,
        "expires_at" TIMESTAMP,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_tx_user FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_transactions_user_status" ON "transactions" ("userId", "status");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saga_steps" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "transactionId" uuid NOT NULL,
        "step_name" varchar(255),
        "step_order" int,
        "status" varchar(50),
        "step_data" jsonb,
        "compensation_data" jsonb,
        "error_message" text,
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_sagestep_tx FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE
      );
    `);

    // Disputes and related
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "disputes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "title" varchar(255) NOT NULL,
        "description" text,
        "type" varchar(100),
        "status" varchar(100),
        "priority" varchar(50),
        "disputeAmount" numeric(18,8),
        "escrowId" uuid,
        "transactionId" uuid,
        "claimantId" uuid,
        "respondentId" uuid,
        "metadata" jsonb,
        "escalatedAt" TIMESTAMP,
        "resolvedAt" TIMESTAMP,
        "deadlineAt" TIMESTAMP,
        "resolution" text,
        "smartContractAddress" varchar(255),
        "smartContractTxHash" varchar(255),
        "isAutomated" boolean DEFAULT false,
        "appealCount" int DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_dispute_claimant FOREIGN KEY ("claimantId") REFERENCES "users" ("id"),
        CONSTRAINT fk_dispute_respondent FOREIGN KEY ("respondentId") REFERENCES "users" ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_disputes_claimant" ON "disputes" ("claimantId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_disputes_respondent" ON "disputes" ("respondentId");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dispute_evidence" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "disputeId" uuid NOT NULL,
        "uploaderId" uuid,
        "url" varchar(1024),
        "metadata" jsonb,
        "createdAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_evidence_dispute FOREIGN KEY ("disputeId") REFERENCES "disputes" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dispute_votes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "disputeId" uuid NOT NULL,
        "voterId" uuid,
        "choice" varchar(50),
        "weight" numeric DEFAULT 1,
        "createdAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_vote_dispute FOREIGN KEY ("disputeId") REFERENCES "disputes" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dispute_timeline" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "disputeId" uuid NOT NULL,
        "event" varchar(255),
        "metadata" jsonb,
        "createdAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_timeline_dispute FOREIGN KEY ("disputeId") REFERENCES "disputes" ("id") ON DELETE CASCADE
      );
    `);

    // Notifications
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "title" varchar(255),
        "body" text,
        "data" jsonb,
        "read" boolean DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT fk_notification_user FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_templates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(255),
        "content" text,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_history" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "notificationId" uuid,
        "deliveredAt" TIMESTAMP,
        "status" varchar(100)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_delivery_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "notificationId" uuid,
        "provider" varchar(100),
        "status" varchar(100),
        "metadata" jsonb,
        "createdAt" TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_notification_preferences" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid UNIQUE,
        "preferences" jsonb,
        CONSTRAINT fk_unpref_user FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);

    // Analytics / metrics tables (lightweight)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "analytics_metrics" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(255),
        "payload" jsonb,
        "createdAt" TIMESTAMP DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order to satisfy FKs
    await queryRunner.query(`DROP TABLE IF EXISTS "analytics_metrics";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_notification_preferences";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_delivery_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_history";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_templates";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications";`);

    await queryRunner.query(`DROP TABLE IF EXISTS "dispute_timeline";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dispute_votes";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dispute_evidence";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "disputes";`);

    await queryRunner.query(`DROP TABLE IF EXISTS "saga_steps";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions";`);

    await queryRunner.query(`DROP TABLE IF EXISTS "escrow_transactions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "escrow_audit_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "escrow_conditions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "escrow_participants";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "escrow_milestones";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "escrow_templates";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "escrows";`);

    await queryRunner.query(`DROP TABLE IF EXISTS "user_activities";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_preferences";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_kyc";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_profiles";`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_username";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);

    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp";`);
  }
}
