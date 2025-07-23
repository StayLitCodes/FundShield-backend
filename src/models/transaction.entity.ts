import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated',
  CANCELLED = 'cancelled',
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  REWARD_CLAIM = 'reward_claim',
  FUND_CREATION = 'fund_creation',
  FUND_INVESTMENT = 'fund_investment',
}

export enum SagaStepStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATED = 'compensated',
}

@Entity('transactions')
@Index(['userId', 'status'])
@Index(['transactionHash'])
@Index(['sagaId'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'saga_id', nullable: true })
  @Index()
  sagaId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'transaction_type', type: 'enum', enum: TransactionType })
  transactionType: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ name: 'transaction_hash', nullable: true, unique: true })
  transactionHash: string;

  @Column({ name: 'block_number', nullable: true })
  blockNumber: number;

  @Column({ name: 'contract_address', nullable: true })
  contractAddress: string;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: string;

  @Column({ name: 'token_address', nullable: true })
  tokenAddress: string;

  @Column({ name: 'from_address', nullable: true })
  fromAddress: string;

  @Column({ name: 'to_address', nullable: true })
  toAddress: string;

  @Column({
    name: 'gas_fee',
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
  })
  gasFee: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', default: 3 })
  maxRetries: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'idempotency_key', unique: true })
  idempotencyKey: string;

  @Column({ name: 'processed_at', nullable: true })
  processedAt: Date;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;

  @OneToMany(() => SagaStep, step => step.transaction, { cascade: true })
  sagaSteps: SagaStep[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('saga_steps')
@Index(['transactionId', 'stepOrder'])
export class SagaStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id' })
  transactionId: string;

  @Column({ name: 'step_name' })
  stepName: string;

  @Column({ name: 'step_order' })
  stepOrder: number;

  @Column({
    type: 'enum',
    enum: SagaStepStatus,
    default: SagaStepStatus.PENDING,
  })
  status: SagaStepStatus;

  @Column({ name: 'step_data', type: 'jsonb', nullable: true })
  stepData: Record<string, any>;

  @Column({ name: 'compensation_data', type: 'jsonb', nullable: true })
  compensationData: Record<string, any>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'transaction', type: 'uuid' })
  transaction: Transaction;
}
