import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { ComplianceRule } from './entities/compliance-rule.entity';

@Injectable()
export class AuditReportService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(ComplianceRule)
    private readonly complianceRuleRepository: Repository<ComplianceRule>,
  ) {}

  async generateAuditReport(filter: any = {}): Promise<AuditLog[]> {
    // Placeholder: filter and return audit logs
    return this.auditLogRepository.find(filter);
  }

  async generateComplianceReport(filter: any = {}): Promise<ComplianceRule[]> {
    // Placeholder: filter and return compliance rules
    return this.complianceRuleRepository.find(filter);
  }

  async exportAuditReport(format: 'json' | 'csv' = 'json', filter: any = {}): Promise<any> {
    const logs = await this.generateAuditReport(filter);
    if (format === 'csv') {
      // Simple CSV export
      const header = Object.keys(logs[0] || {}).join(',');
      const rows = logs.map(log => Object.values(log).join(','));
      return [header, ...rows].join('\n');
    }
    return logs;
  }

  async exportComplianceReport(format: 'json' | 'csv' = 'json', filter: any = {}): Promise<any> {
    const rules = await this.generateComplianceReport(filter);
    if (format === 'csv') {
      const header = Object.keys(rules[0] || {}).join(',');
      const rows = rules.map(rule => Object.values(rule).join(','));
      return [header, ...rows].join('\n');
    }
    return rules;
  }
} 