import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1693040000000 implements MigrationInterface {
  name = 'InitialSchema1693040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      CREATE TABLE "users" (
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

    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email");`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_username" ON "users" ("username");`);

    await queryRunner.query(`
      CREATE TABLE "escrows" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "escrowNumber" varchar(255) NOT NULL,
        "title" varchar(255) NOT NULL,
        "type" varchar(50) NOT NULL,
        "status" varchar(50) NOT NULL,
        "buyerId" uuid NOT NULL,
        "sellerId" uuid NOT NULL,
        "totalAmount" numeric(15,4) NOT NULL,
        "currency" varchar(10) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_escrows_number" ON "escrows" ("escrowNumber");`);
    await queryRunner.query(`CREATE INDEX "IDX_escrows_buyer_seller" ON "escrows" ("buyerId", "sellerId");`);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "sagaId" uuid,
        "userId" uuid NOT NULL,
        "transaction_type" varchar(100) NOT NULL,
        "status" varchar(100) NOT NULL,
        "transaction_hash" varchar(255),
        "amount" numeric(36,18) NOT NULL,
        "idempotency_key" varchar(255) NOT NULL,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_transactions_idempotency" ON "transactions" ("idempotency_key");`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_user_status" ON "transactions" ("userId", "status");`);

    await queryRunner.query(`
      CREATE TABLE "disputes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "title" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "type" varchar(100) NOT NULL,
        "status" varchar(100) NOT NULL,
        "disputeAmount" numeric(18,8) NOT NULL,
        "claimantId" uuid NOT NULL,
        "respondentId" uuid NOT NULL,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      );
    `);

    await queryRunner.query(`CREATE INDEX "IDX_disputes_claimant" ON "disputes" ("claimantId");`);
    await queryRunner.query(`CREATE INDEX "IDX_disputes_respondent" ON "disputes" ("respondentId");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_respondent";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_claimant";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "disputes";`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_user_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_idempotency";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions";`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_escrows_buyer_seller";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_escrows_number";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "escrows";`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_username";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);

    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp";`);
  }
}
