import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { Repository } from 'typeorm';

describe('AuditService', () => {
  let service: AuditService;
  let repo: Repository<AuditLog>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repo = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  it('should create a log with hash chaining', async () => {
    jest.spyOn(repo, 'find').mockResolvedValueOnce([]);
    jest.spyOn(repo, 'save').mockImplementation(async (log) => log);
    const log = await service.createLog({
      user: 'test',
      action: 'CREATE',
      resource: 'User',
      oldValue: null,
      newValue: { name: 'Alice' },
      metadata: {},
    });
    expect(log.hash).toBeDefined();
    expect(log.previousHash).toBeNull();
  });

  it('should verify audit trail integrity', async () => {
    const logs = [
      {
        user: 'a', action: 'CREATE', resource: 'X', oldValue: null, newValue: { x: 1 }, timestamp: new Date(), previousHash: null, metadata: {},
      },
      {
        user: 'b', action: 'UPDATE', resource: 'X', oldValue: { x: 1 }, newValue: { x: 2 }, timestamp: new Date(), previousHash: 'hash1', metadata: {},
      },
    ];
    logs[0].hash = service.computeHash(logs[0]);
    logs[1].previousHash = logs[0].hash;
    logs[1].hash = service.computeHash(logs[1]);
    jest.spyOn(repo, 'find').mockResolvedValue(logs as any);
    const result = await service.verifyAuditTrail();
    expect(result).toBe(true);
  });

  it('should detect tampered audit trail', async () => {
    const logs = [
      {
        user: 'a', action: 'CREATE', resource: 'X', oldValue: null, newValue: { x: 1 }, timestamp: new Date(), previousHash: null, metadata: {},
      },
      {
        user: 'b', action: 'UPDATE', resource: 'X', oldValue: { x: 1 }, newValue: { x: 2 }, timestamp: new Date(), previousHash: 'hash1', metadata: {},
      },
    ];
    logs[0].hash = service.computeHash(logs[0]);
    logs[1].previousHash = logs[0].hash;
    logs[1].hash = 'tampered';
    jest.spyOn(repo, 'find').mockResolvedValue(logs as any);
    const result = await service.verifyAuditTrail();
    expect(result).toBe(false);
  });
});

describe('GDPR privacy compliance', () => {
  it('should erase all user data', async () => {
    jest.spyOn(repo, 'delete').mockResolvedValue({ affected: 3 } as any);
    // Mock complianceRepo for complianceRuleRepository.delete
    service['complianceRuleRepository'] = { delete: jest.fn().mockResolvedValue({ affected: 2 }) } as any;
    const result = await service.eraseUserData('user1');
    expect(result.auditLogs).toBe(3);
    expect(result.complianceRules).toBe(2);
  });

  it('should minimize user data', async () => {
    jest.spyOn(repo, 'update').mockResolvedValue({ affected: 3 } as any);
    // Mock complianceRepo for complianceRuleRepository.update
    service['complianceRuleRepository'] = { update: jest.fn().mockResolvedValue({ affected: 2 }) } as any;
    const result = await service.minimizeUserData('user1');
    expect(result.auditLogs).toBe(3);
    expect(result.complianceRules).toBe(2);
  });
}); 