import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EvidenceType } from '../enums/evidence-type.enum';
import { EvidenceStatus } from '../enums/evidence-status.enum';
import { DisputeCase } from './dispute-case.entity';

@Entity('dispute_evidence')
@Index(['disputeId', 'submittedAt'])
export class DisputeEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  disputeId: string;

  @Column({ type: 'enum', enum: EvidenceType })
  type: EvidenceType;

  @Column({ type: 'enum', enum: EvidenceStatus, default: EvidenceStatus.PENDING })
  status: EvidenceStatus;

  @Column({ type: 'uuid' })
  submittedBy: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ nullable: true })
  ipfsHash: string;

  @Column({ nullable: true })
  fileHash: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ nullable: true })
  mimeType: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  verifiedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date;

  @CreateDateColumn()
  submittedAt: Date;

  @ManyToOne(() => DisputeCase, dispute => dispute.evidence)
  @JoinColumn({ name: 'disputeId' })
  dispute: DisputeCase;
}