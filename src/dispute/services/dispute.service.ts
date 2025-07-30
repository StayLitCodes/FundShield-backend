import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Dispute } from '../entities/dispute.entity';
import { DisputeStatus, DisputeType, DisputePriority } from '../enums/dispute.enum';
import { CreateDisputeDto, UpdateDisputeDto, DisputeFilterDto } from '../dto/dispute.dto';
import { ArbitratorSelectionService } from './arbitrator-selection.service';
import { DisputeTimelineService } from './dispute-timeline.service';
import { SmartContractIntegrationService } from './smart-contract-integration.service';

@Injectable()
export class DisputeService {
  private readonly logger = new Logger(DisputeService.name);

  constructor(
    @InjectRepository(Dispute)
    private disputeRepository: Repository<Dispute>,
    @InjectQueue('dispute-processing')
    private disputeQueue: Queue,
    private arbitratorSelectionService: ArbitratorSelectionService,
    private timelineService: DisputeTimelineService,
    private smartContractService: SmartContractIntegrationService,
  ) {}

  /**
   * Create a new dispute
   */
  async createDispute(dto: CreateDisputeDto): Promise<Dispute> {
    try {
      const dispute = this.disputeRepository.create({
        ...dto,
        status: DisputeStatus.PENDING,
        deadlineAt: this.calculateDeadline(dto.type, dto.priority),
      });

      const savedDispute = await this.disputeRepository.save(dispute);

      // Add to timeline
      await this.timelineService.addEvent(savedDispute.id, {
        action: 'dispute_created',
        description: 'Dispute has been created',
        metadata: { disputeType: dto.type },
      });

      // Queue for automated processing
      await this.disputeQueue.add('process-new-dispute', {
        disputeId: savedDispute.id,
      });

      this.logger.log(`Dispute created: ${savedDispute.id}`);
      return savedDispute;
    } catch (error) {
      this.logger.error(`Error creating dispute: ${error.message}`);
      throw new BadRequestException('Failed to create dispute');
    }
  }

  /**
   * Get dispute by ID
   */
  async getDisputeById(id: string): Promise<Dispute> {
    const dispute = await this.disputeRepository.findOne({
      where: { id },
      relations: ['claimant', 'respondent', 'evidence', 'votes', 'timeline'],
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    return dispute;
  }

  /**
   * Update dispute status
   */
  async updateDisputeStatus(id: string, status: DisputeStatus, metadata?: any): Promise<Dispute> {
    const dispute = await this.getDisputeById(id);
    
    const previousStatus = dispute.status;
    dispute.status = status;
    dispute.metadata = { ...dispute.metadata, ...metadata };

    if (status === DisputeStatus.RESOLVED) {
      dispute.resolvedAt = new Date();
    }

    const updatedDispute = await this.disputeRepository.save(dispute);

    // Add to timeline
    await this.timelineService.addEvent(id, {
      action: 'status_changed',
      description: `Status changed from ${previousStatus} to ${status}`,
      metadata: { previousStatus, newStatus: status, ...metadata },
    });

    this.logger.log(`Dispute ${id} status updated to ${status}`);
    return updatedDispute;
  }

  /**
   * Escalate dispute to human arbitration
   */
  async escalateDispute(id: string): Promise<Dispute> {
    const dispute = await this.getDisputeById(id);

    if (dispute.status !== DisputeStatus.PENDING && dispute.status !== DisputeStatus.UNDER_REVIEW) {
      throw new BadRequestException('Dispute cannot be escalated in current status');
    }

    // Select arbitrators
    const arbitrators = await this.arbitratorSelectionService.selectArbitrators(dispute);

    const updatedDispute = await this.updateDisputeStatus(
      id,
      DisputeStatus.ARBITRATION,
      {
        escalatedAt: new Date(),
        selectedArbitrators: arbitrators.map(a => a.id),
      }
    );

    // Notify arbitrators
    await this.disputeQueue.add('notify-arbitrators', {
      disputeId: id,
      arbitratorIds: arbitrators.map(a => a.id),
    });

    return updatedDispute;
  }

  /**
   * Resolve dispute
   */
  async resolveDispute(id: string, resolution: string, executorId: string): Promise<Dispute> {
    const dispute = await this.getDisputeById(id);

    dispute.resolution = resolution;
    dispute.resolvedAt = new Date();
    dispute.status = DisputeStatus.RESOLVED;

    const resolvedDispute = await this.disputeRepository.save(dispute);

    // Execute resolution via smart contract
    if (dispute.smartContractAddress) {
      await this.smartContractService.executeResolution(dispute, resolution);
    }

    // Add to timeline
    await this.timelineService.addEvent(id, {
      action: 'dispute_resolved',
      description: 'Dispute has been resolved',
      metadata: { resolution, executorId },
    });

    this.logger.log(`Dispute ${id} resolved`);
    return resolvedDispute;
  }

  /**
   * Get disputes with filtering
   */
  async getDisputes(filter: DisputeFilterDto): Promise<{ disputes: Dispute[]; total: number }> {
    const queryBuilder = this.disputeRepository.createQueryBuilder('dispute')
      .leftJoinAndSelect('dispute.claimant', 'claimant')
      .leftJoinAndSelect('dispute.respondent', 'respondent');

    if (filter.status) {
      queryBuilder.andWhere('dispute.status = :status', { status: filter.status });
    }

    if (filter.type) {
      queryBuilder.andWhere('dispute.type = :type', { type: filter.type });
    }

    if (filter.priority) {
      queryBuilder.andWhere('dispute.priority = :priority', { priority: filter.priority });
    }

    if (filter.claimantId) {
      queryBuilder.andWhere('dispute.claimantId = :claimantId', { claimantId: filter.claimantId });
    }

    if (filter.respondentId) {
      queryBuilder.andWhere('dispute.respondentId = :respondentId', { respondentId: filter.respondentId });
    }

    const total = await queryBuilder.getCount();
    
    if (filter.page && filter.limit) {
      queryBuilder
        .skip((filter.page - 1) * filter.limit)
        .take(filter.limit);
    }

    queryBuilder.orderBy('dispute.createdAt', 'DESC');
    
    const disputes = await queryBuilder.getMany();

    return { disputes, total };
  }

  /**
   * Check for expired disputes
   */
  async checkExpiredDisputes(): Promise<void> {
    const expiredDisputes = await this.disputeRepository
      .createQueryBuilder('dispute')
      .where('dispute.deadlineAt < :now', { now: new Date() })
      .andWhere('dispute.status NOT IN (:...finalStatuses)', {
        finalStatuses: [DisputeStatus.RESOLVED, DisputeStatus.CLOSED, DisputeStatus.EXPIRED],
      })
      .getMany();

    for (const dispute of expiredDisputes) {
      await this.updateDisputeStatus(dispute.id, DisputeStatus.EXPIRED);
      
      // Auto-resolve based on default rules
      await this.disputeQueue.add('auto-resolve-expired', {
        disputeId: dispute.id,
      });
    }

    this.logger.log(`Processed ${expiredDisputes.length} expired disputes`);
  }

  /**
   * Calculate dispute deadline based on type and priority
   */
  private calculateDeadline(type: DisputeType, priority: DisputePriority): Date {
    const now = new Date();
    let days = 7; // Default 7 days

    // Adjust based on priority
    switch (priority) {
      case DisputePriority.URGENT:
        days = 1;
        break;
      case DisputePriority.HIGH:
        days = 3;
        break;
      case DisputePriority.MEDIUM:
        days = 7;
        break;
      case DisputePriority.LOW:
        days = 14;
        break;
    }

    // Adjust based on type
    switch (type) {
      case DisputeType.FRAUD_CLAIM:
        days = Math.min(days, 2); // Fraud claims are urgent
        break;
      case DisputeType.PAYMENT_DISPUTE:
        days = Math.min(days, 5);
        break;
    }

    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }
}