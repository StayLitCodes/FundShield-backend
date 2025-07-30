import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Dispute } from './dispute.entity';
import { Arbitrator } from './arbitrator.entity';
import { VoteDecision } from '../enums/vote.enum';

@Entity('votes')
export class Vote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  disputeId: string;

  @Column({ type: 'uuid' })
  arbitratorId: string;

  @Column({
    type: 'enum',
    enum: VoteDecision,
  })
  decision: VoteDecision;

  @Column({ type: 'text', nullable: true })
  reasoning: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1.0 })
  weight: number;

  @Column({ type: 'boolean', default: false })
  isCommitted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  committedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  commitHash: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Dispute, (dispute) => dispute.votes)
  @JoinColumn({ name: 'disputeId' })
  dispute: Dispute;

  @ManyToOne(() => Arbitrator, (arbitrator) => arbitrator.votes)
  @JoinColumn({ name: 'arbitratorId' })
  arbitrator: Arbitrator;

  @CreateDateColumn()
  createdAt: Date;
}