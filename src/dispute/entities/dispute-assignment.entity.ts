import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AssignmentStatus } from '../enums/assignment-status.enum';
import { Arbitrator } from './arbitrator.entity';
import { DisputeCase } from './dispute-case.entity';

@Entity('dispute_assignments')
@Index(['status', 'assignedAt'])
export class DisputeAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  disputeId: string;

  @Column({ type: 'uuid' })
  arbitratorId: string;

  @Column({ type: 'enum', enum: AssignmentStatus, default: AssignmentStatus.ASSIGNED })
  status: AssignmentStatus;

  @Column({ type: 'int', default: 1 })
  tier: number;

  @Column({ type: 'timestamp' })
  assignedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date;

  @Column({ type: 'json', nullable: true })
  decision: {
    ruling: string;
    reasoning: string;
    compensation?: number;
    additionalActions?: string[];
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Arbitrator, arbitrator => arbitrator.assignments)
  @JoinColumn({ name: 'arbitratorId' })
  arbitrator: Arbitrator;

  @ManyToOne(() => DisputeCase, dispute => dispute.assignments)
  @JoinColumn({ name: 'disputeId' })
  dispute: DisputeCase;
}