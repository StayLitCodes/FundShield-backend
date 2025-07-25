import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ nullable: true })
  user: string;

  @Column()
  action: string;

  @Column()
  resource: string;

  @Column('json', { nullable: true })
  oldValue: any;

  @Column('json', { nullable: true })
  newValue: any;

  @Column({ nullable: true })
  hash: string;

  @Column({ nullable: true })
  previousHash: string;

  @Column('json', { nullable: true })
  metadata: any;
} 