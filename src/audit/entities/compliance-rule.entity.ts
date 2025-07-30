import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('compliance_rules')
export class ComplianceRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string; // e.g., AML, KYC

  @Column()
  status: string; // e.g., PASSED, FAILED, PENDING

  @Column('json', { nullable: true })
  details: any;

  @Column({ nullable: true })
  user: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column('json', { nullable: true })
  result: any;
} 