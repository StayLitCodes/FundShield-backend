import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Evidence } from './evidence.entity';
import { Vote } from './vote.entity';
import { Appeal } from './appeal.entity';
import { DisputeTimeline } from './dispute-timeline.entity';
import { DisputeStatus, DisputeType, DisputePriority } from '../enums/dispute.enum';

@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: DisputeType,
    default: DisputeType.PAYMENT_DISPUTE,
  })
  type: DisputeType;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.PENDING,
  })
  status: DisputeStatus;

  @Column({
    type: 'enum',
    enum: DisputePriority,
    default: DisputePriority.MEDIUM,
  })
  priority: DisputePriority;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  disputeAmount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  escrowId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  transactionId: string;

  @Column({ type: 'uuid' })
  claimantId: string;

  @Column({ type: 'uuid' })
  respondentId: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  escalatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deadlineAt: Date;

  @Column({ type: 'text', nullable: true })
  resolution: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  smartContractAddress: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  smartContractTxHash: string;

  @Column({ type: 'boolean', default: false })
  isAutomated: boolean;

  @Column({ type: 'int', default: 0 })
  appealCount: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'claimantId' })
  claimant: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'respondentId' })
  respondent: User;

  @OneToMany(() => Evidence, (evidence) => evidence.dispute)
  evidence: Evidence[];

  @OneToMany(() => Vote, (vote) => vote.dispute)
  votes: Vote[];

  @OneToMany(() => Appeal, (appeal) => appeal.dispute)
  appeals: Appeal[];

  @OneToMany(() => DisputeTimeline, (timeline) => timeline.dispute)
  timeline: DisputeTimeline[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}