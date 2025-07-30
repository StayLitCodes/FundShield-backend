import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appeal } from '../entities/appeal.entity';
import { Dispute } from '../entities/dispute.entity';
import { DisputeStatus } from '../enums/dispute.enum';
import { AppealStatus } from '../enums/appeal.enum';
import { CreateAppealDto, ReviewAppealDto } from '../dto/appeal.dto';
import { DisputeService } from './dispute.service';
import { ArbitratorSelectionService } from './arbitrator-selection.service';

@Injectable()
export class AppealService {
  private readonly logger = new Logger(AppealService.name);
  private readonly maxAppeals = 2; // Maximum number of appeals allowed

  constructor(
    @InjectRepository(Appeal)
    private appealRepository: Repository<Appeal>,
    @InjectRepository(Dispute)
    private disputeRepository: Repository<Dispute>,
    private disputeService: DisputeService,
    private arbitratorSelectionService: ArbitratorSelectionService,
  ) {}

  /**
   * Create an appeal
   */
  async createAppeal(dto: CreateAppealDto): Promise<Appeal> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: dto.disputeId },
      relations: ['appeals'],
    });

    if (!dispute) {
      throw new BadRequestException('Dispute not found');
    }

    if (dispute.status !== DisputeStatus.RESOLVED) {
      throw new BadRequestException('Can only appeal resolved disputes');
    }

    if (dispute.appeals.length >= this.maxAppeals) {
      throw new BadRequestException(`Maximum ${this.maxAppeals} appeals allowed`);
    }

    // Check if appeal is within time limit (e.g., 7 days)
    const appealDeadline = new Date(dispute.resolvedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (new Date() > appeal