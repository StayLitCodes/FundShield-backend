import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComplianceRule } from './entities/compliance-rule.entity';
import { ComplianceCheckRequestDto, ComplianceCheckResponseDto } from './dto/compliance-check.dto';

@Injectable()
export class ComplianceService {
  constructor(
    @InjectRepository(ComplianceRule)
    private readonly complianceRuleRepository: Repository<ComplianceRule>,
  ) {}

  async checkCompliance(request: ComplianceCheckRequestDto): Promise<ComplianceCheckResponseDto> {
    let status = 'PASSED';
    let details = {};
    if (request.type === 'KYC') {
      if (!request.user) {
        status = 'FAILED';
        details = { reason: 'User missing' };
      }
    } else if (request.type === 'AML') {
      if (request.data && request.data.amount > 10000) {
        status = 'FAILED';
        details = { reason: 'Amount exceeds threshold' };
      }
    }
    const rule = this.complianceRuleRepository.create({
      type: request.type,
      status,
      details,
      user: request.user,
      result: request.data,
    });
    await this.complianceRuleRepository.save(rule);
    return { status, details, result: request.data };
  }
} 