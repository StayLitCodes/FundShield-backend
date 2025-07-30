import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import * as crypto from 'crypto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async createLog(log: Partial<AuditLog>): Promise<AuditLog> {
    // Get the latest log to chain hashes
    const previousLog = await this.auditLogRepository.find({
      order: { timestamp: 'DESC' },
      take: 1,
    });
    const previousHash = previousLog[0]?.hash || null;
    const logToSave = {
      ...log,
      previousHash,
    };
    // Compute hash
    const hash = this.computeHash(logToSave);
    logToSave.hash = hash;
    return this.auditLogRepository.save(logToSave);
  }

  computeHash(log: Partial<AuditLog>): string {
    const data = JSON.stringify({
      user: log.user,
      action: log.action,
      resource: log.resource,
      oldValue: log.oldValue,
      newValue: log.newValue,
      timestamp: log.timestamp,
      previousHash: log.previousHash,
      metadata: log.metadata,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async verifyAuditTrail(): Promise<boolean> {
    const logs = await this.auditLogRepository.find({ order: { timestamp: 'ASC' } });
    let previousHash = null;
    for (const log of logs) {
      const expectedHash = this.computeHash({
        user: log.user,
        action: log.action,
        resource: log.resource,
        oldValue: log.oldValue,
        newValue: log.newValue,
        timestamp: log.timestamp,
        previousHash: log.previousHash,
        metadata: log.metadata,
      });
      if (log.hash !== expectedHash || log.previousHash !== previousHash) {
        return false;
      }
      previousHash = log.hash;
    }
    return true;
  }

  async eraseUserData(user: string): Promise<{ auditLogs: number; complianceRules: number }> {
    const auditResult = await this.auditLogRepository.delete({ user });
    const complianceResult = await this.complianceRuleRepository.delete({ user });
    return {
      auditLogs: auditResult.affected || 0,
      complianceRules: complianceResult.affected || 0,
    };
  }

  async minimizeUserData(user: string): Promise<{ auditLogs: number; complianceRules: number }> {
    const auditResult = await this.auditLogRepository.update({ user }, { user: 'anonymized' });
    const complianceResult = await this.complianceRuleRepository.update({ user }, { user: 'anonymized' });
    return {
      auditLogs: auditResult.affected || 0,
      complianceRules: complianceResult.affected || 0,
    };
  }
} 