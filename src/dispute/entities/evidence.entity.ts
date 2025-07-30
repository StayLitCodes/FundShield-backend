import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Dispute } from './dispute.entity';
import { User } from '../../user/entities/user.entity';
import { EvidenceType, EvidenceStatus } from '../enums/evidence.enum';

@Entity('evidence')
export class Evidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  disputeId: string;

  @Column({ type: 'uuid' })
  submittedBy: string;

  @Column({
    type: 'enum',
    enum: EvidenceType,
  })
  type: EvidenceType;

  @Column({
    type: 'enum',
    enum: EvidenceStatus,
    default: EvidenceStatus.PENDING_REVIEW,
  })
  status: EvidenceStatus;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 500 })
  ipfsHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  checksum: string;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  verifiedBy: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Dispute, (dispute) => dispute.evidence)
  @JoinColumn({ name: 'disputeId' })
  dispute: Dispute;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'submittedBy' })
  submitter: User;

  @CreateDateColumn()
  createdAt: Date;
}