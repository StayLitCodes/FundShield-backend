import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Dispute } from './dispute.entity';
import { Arbitrator } from './arbitrator.entity';

export enum VoteDecision {
  FAVOR_COMPLAINANT = 'favor_complainant',
  FAVOR_RESPONDENT = 'favor_respondent',
  PARTIAL_COMPLAINANT = 'partial_complainant',
  PARTIAL_RESPONDENT = 'partial_respondent',
  DISMISS = 'dismiss',
  REQUIRE_MORE_EVIDENCE = 'require_more_evidence',
}

@Entity('arbitration_votes')
@Index(['disputeId', 'arbitratorId'], { unique: true })
export class ArbitrationVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Dispute, dispute => dispute.votes)
  @JoinColumn({ name: 'dispute_id' })
  dispute: Dispute;

  @Column({ name: 'dispute_id' })
  disputeId: string;

  @ManyToOne(() => Arbitrator, arbitrator => arbitrator.votes)
  @JoinColumn({ name: 'arbitrator_id' })
  arbitrator: Arbitrator;

  @Column({ name: 'arbitrator_id' })
  arbitratorId: string;

  @Column({ type: 'enum', enum: VoteDecision })
  decision: VoteDecision;

  @Column({ name: 'award_amount', type: 'decimal', precision: 18, scale: 8, nullable: true })
  awardAmount: string;

  @Column({ type: 'text', nullable: true })
  reasoning: string;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidenceScore: number;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}