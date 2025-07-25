import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceService } from '../compliance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ComplianceRule } from '../entities/compliance-rule.entity';
import { Repository } from 'typeorm';
import { ComplianceCheckRequestDto } from '../dto/compliance-check.dto';

describe('ComplianceService', () => {
  let service: ComplianceService;
  let repo: Repository<ComplianceRule>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        {
          provide: getRepositoryToken(ComplianceRule),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<ComplianceService>(ComplianceService);
    repo = module.get<Repository<ComplianceRule>>(getRepositoryToken(ComplianceRule));
  });

  it('should pass KYC if user is present', async () => {
    jest.spyOn(repo, 'create').mockImplementation((x) => x as any);
    jest.spyOn(repo, 'save').mockResolvedValue({} as any);
    const req: ComplianceCheckRequestDto = { user: 'user1', type: 'KYC', data: {} };
    const res = await service.checkCompliance(req);
    expect(res.status).toBe('PASSED');
  });

  it('should fail KYC if user is missing', async () => {
    jest.spyOn(repo, 'create').mockImplementation((x) => x as any);
    jest.spyOn(repo, 'save').mockResolvedValue({} as any);
    const req: ComplianceCheckRequestDto = { user: '', type: 'KYC', data: {} };
    const res = await service.checkCompliance(req);
    expect(res.status).toBe('FAILED');
    expect(res.details).toHaveProperty('reason');
  });

  it('should pass AML if amount is below threshold', async () => {
    jest.spyOn(repo, 'create').mockImplementation((x) => x as any);
    jest.spyOn(repo, 'save').mockResolvedValue({} as any);
    const req: ComplianceCheckRequestDto = { user: 'user1', type: 'AML', data: { amount: 5000 } };
    const res = await service.checkCompliance(req);
    expect(res.status).toBe('PASSED');
  });

  it('should fail AML if amount is above threshold', async () => {
    jest.spyOn(repo, 'create').mockImplementation((x) => x as any);
    jest.spyOn(repo, 'save').mockResolvedValue({} as any);
    const req: ComplianceCheckRequestDto = { user: 'user1', type: 'AML', data: { amount: 20000 } };
    const res = await service.checkCompliance(req);
    expect(res.status).toBe('FAILED');
    expect(res.details).toHaveProperty('reason');
  });
}); 