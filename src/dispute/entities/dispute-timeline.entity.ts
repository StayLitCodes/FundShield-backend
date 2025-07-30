import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TimelineEventType } from '../enums/timeline-event-type.enum';
import { DisputeCase } from './dispute-case.entity';

@Entity('dispute_timeline')
@Index(['disputeId', 'createdAt'])
export class DisputeTimeline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  disputeId: string;

  @Column({ type: 'enum', enum: TimelineEventType })
  eventType: TimelineEventType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'uuid', nullable: true })
  actorId: string;

  @Column({ nullable: true })
  actorRole: string;

  @Column({ type: 'json', nullable: true })
  eventData: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => DisputeCase, dispute => dispute.timeline)
  @JoinColumn({ name: 'disputeId' })
  dispute: DisputeCase;
}