import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DisputeStatus } from '../enums/dispute-status.enum';
import { DisputeType } from '../enums/dispute-type.enum';
import { DisputePriority } from '../enums/dispute-priority.enum';
import { DisputeAssignment } from './dispute-assignment.entity';
import { DisputeEvidence } from './dispute-evidence.entity';
import { DisputeTimeline } from './dispute-timeline.entity';
import { Escrow } from '../../escrow/entities/escrow.entity';

@Entity('dispute_cases')
@Index(['status', 'priority', 'createdAt'])
@Index(['escrowId'])
export class DisputeCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  escrowId: string;

  @Column({ type: 'varchar', unique: true })
  caseNumber: string;

  @Column({ type: 'enum', enum: DisputeType })
  type: DisputeType;

  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @Column({ type: 'enum', enum: DisputePriority, default: DisputePriority.MEDIUM })
  priority: DisputePriority;

  @Column({ type: 'uuid' })
  initiatedBy: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  disputedAmount: number;

  @Column({ type: 'int', default: 1 })
  currentTier: number;

  @Column({ type: 'timestamp', nullable: true })
  autoEscalationAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string;

  @Column({ type: 'text', nullable: true })
  finalResolution: string;

  @Column({ type: 'json', nullable: true })
  smartContractData: {
    contractAddress?: string;
    transactionHash?: string;
    blockNumber?: number;
    gasUsed?: number;
  };

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Escrow, escrow => escrow.disputes)
  @JoinColumn({ name: 'escrowId' })
  escrow: Escrow;

  @OneToMany(() => DisputeAssignment, assignment => assignment.dispute)
  assignments: DisputeAssignment[];

  @OneToMany(() => DisputeEvidence, evidence => evidence.dispute)
  evidence: DisputeEvidence[];

  @OneToMany(() => DisputeTimeline, timeline => timeline.dispute)
  timeline: DisputeTimeline[];
}