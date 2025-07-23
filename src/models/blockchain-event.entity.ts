import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum EventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  DEAD_LETTER = 'dead_letter',
}

export enum EventType {
  TRANSFER = 'transfer',
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  REWARD = 'reward',
  GOVERNANCE = 'governance',
}

@Entity('blockchain_events')
@Index(['blockNumber', 'transactionHash'])
@Index(['eventType', 'status'])
@Index(['contractAddress', 'eventName'])
export class BlockchainEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 66 })
  @Index()
  transactionHash: string;

  @Column({ type: 'varchar', length: 66 })
  blockHash: string;

  @Column({ type: 'bigint' })
  @Index()
  blockNumber: number;

  @Column({ type: 'varchar', length: 66 })
  @Index()
  contractAddress: string;

  @Column({ type: 'varchar', length: 100 })
  eventName: string;

  @Column({ type: 'enum', enum: EventType })
  @Index()
  eventType: EventType;

  @Column({ type: 'jsonb' })
  eventData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  decodedData: Record<string, any>;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.PENDING })
  @Index()
  status: EventStatus;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastRetryAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
