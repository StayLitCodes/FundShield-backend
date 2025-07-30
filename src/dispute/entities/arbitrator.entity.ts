import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ArbitratorStatus } from '../enums/arbitrator-status.enum';
import { DisputeAssignment } from './dispute-assignment.entity';

@Entity('arbitrators')
@Index(['status', 'specialization'])
@Index(['reputationScore'])
export class Arbitrator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: ArbitratorStatus, default: ArbitratorStatus.ACTIVE })
  status: ArbitratorStatus;

  @Column('simple-array')
  specializations: string[];

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  reputationScore: number;

  @Column({ type: 'int', default: 0 })
  totalCases: number;

  @Column({ type: 'int', default: 0 })
  resolvedCases: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  averageResolutionTime: number;

  @Column({ type: 'int', default: 0 })
  currentCaseload: number;

  @Column({ type: 'int', default: 10 })
  maxCaseload: number;

  @Column({ type: 'json', nullable: true })
  qualifications: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  availability: {
    timezone: string;
    workingHours: { start: string; end: string };
    workingDays: string[];
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => DisputeAssignment, assignment => assignment.arbitrator)
  assignments: DisputeAssignment[];
}