import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { ComplianceRule } from './entities/compliance-rule.entity';

@Injectable()
export class DataRetentionService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(ComplianceRule)
    private readonly complianceRuleRepository: Repository<ComplianceRule>,
  ) {}

  async purgeOldRecords(retentionDays: number): Promise<{ auditLogs: number; complianceRules: number }> {
    // Placeholder: calculate cutoff date
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    // Placeholder: delete records older than cutoff
    const auditResult = await this.auditLogRepository.delete({ timestamp: LessThan(cutoff) });
    const complianceResult = await this.complianceRuleRepository.delete({ timestamp: LessThan(cutoff) });
    return {
      auditLogs: auditResult.affected || 0,
      complianceRules: complianceResult.affected || 0,
    };
  }
} 