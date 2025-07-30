import { Test, TestingModule } from '@nestjs/testing';
import { AuditReportService } from '../audit-report.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { ComplianceRule } from '../entities/compliance-rule.entity';
import { Repository } from 'typeorm';

describe('AuditReportService', () => {
  let service: AuditReportService;
  let auditRepo: Repository<AuditLog>;
  let complianceRepo: Repository<ComplianceRule>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditReportService,
        { provide: getRepositoryToken(AuditLog), useClass: Repository },
        { provide: getRepositoryToken(ComplianceRule), useClass: Repository },
      ],
    }).compile();
    service = module.get<AuditReportService>(AuditReportService);
    auditRepo = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
    complianceRepo = module.get<Repository<ComplianceRule>>(getRepositoryToken(ComplianceRule));
  });

  it('should generate audit report', async () => {
    const logs = [{ id: '1', action: 'CREATE' } as AuditLog];
    jest.spyOn(auditRepo, 'find').mockResolvedValue(logs);
    const result = await service.generateAuditReport();
    expect(result).toEqual(logs);
  });

  it('should generate compliance report', async () => {
    const rules = [{ id: '1', type: 'KYC' } as ComplianceRule];
    jest.spyOn(complianceRepo, 'find').mockResolvedValue(rules);
    const result = await service.generateComplianceReport();
    expect(result).toEqual(rules);
  });

  it('should export audit report as JSON', async () => {
    const logs = [{ id: '1', action: 'CREATE' } as AuditLog];
    jest.spyOn(auditRepo, 'find').mockResolvedValue(logs);
    const result = await service.exportAuditReport('json');
    expect(result).toEqual(logs);
  });

  it('should export audit report as CSV', async () => {
    const logs = [{ id: '1', action: 'CREATE' } as AuditLog];
    jest.spyOn(auditRepo, 'find').mockResolvedValue(logs);
    const result = await service.exportAuditReport('csv');
    expect(result).toContain('id,action');
    expect(result).toContain('1,CREATE');
  });

  it('should export compliance report as JSON', async () => {
    const rules = [{ id: '1', type: 'KYC' } as ComplianceRule];
    jest.spyOn(complianceRepo, 'find').mockResolvedValue(rules);
    const result = await service.exportComplianceReport('json');
    expect(result).toEqual(rules);
  });

  it('should export compliance report as CSV', async () => {
    const rules = [{ id: '1', type: 'KYC' } as ComplianceRule];
    jest.spyOn(complianceRepo, 'find').mockResolvedValue(rules);
    const result = await service.exportComplianceReport('csv');
    expect(result).toContain('id,type');
    expect(result).toContain('1,KYC');
  });
}); 