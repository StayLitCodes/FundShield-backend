import { Test, TestingModule } from '@nestjs/testing';
import { DataRetentionService } from '../data-retention.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { ComplianceRule } from '../entities/compliance-rule.entity';
import { Repository } from 'typeorm';

describe('DataRetentionService', () => {
  let service: DataRetentionService;
  let auditRepo: Repository<AuditLog>;
  let complianceRepo: Repository<ComplianceRule>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataRetentionService,
        { provide: getRepositoryToken(AuditLog), useClass: Repository },
        { provide: getRepositoryToken(ComplianceRule), useClass: Repository },
      ],
    }).compile();
    service = module.get<DataRetentionService>(DataRetentionService);
    auditRepo = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
    complianceRepo = module.get<Repository<ComplianceRule>>(getRepositoryToken(ComplianceRule));
  });

  it('should purge old records', async () => {
    jest.spyOn(auditRepo, 'delete').mockResolvedValue({ affected: 2 } as any);
    jest.spyOn(complianceRepo, 'delete').mockResolvedValue({ affected: 1 } as any);
    const result = await service.purgeOldRecords(30);
    expect(result.auditLogs).toBe(2);
    expect(result.complianceRules).toBe(1);
  });

  it('should return 0 if no records deleted', async () => {
    jest.spyOn(auditRepo, 'delete').mockResolvedValue({ affected: 0 } as any);
    jest.spyOn(complianceRepo, 'delete').mockResolvedValue({ affected: 0 } as any);
    const result = await service.purgeOldRecords(30);
    expect(result.auditLogs).toBe(0);
    expect(result.complianceRules).toBe(0);
  });
}); 