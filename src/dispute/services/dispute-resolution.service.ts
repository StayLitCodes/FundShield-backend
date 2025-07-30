import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DisputeCase } from '../entities/dispute-case.entity';
import { DisputeAssignment } from '../entities/dispute-assignment.entity';
import { DisputeEvidence } from '../entities/dispute-evidence.entity';
import { DisputeTimeline } from '../entities/dispute-timeline.entity';
import { Arbitrator } from '../entities/arbitrator.entity';
import { DisputeStatus } from '../enums/dispute-status.enum';
import { DisputePriority } from '../enums/dispute-priority.enum';
import { AssignmentStatus } from '../enums/assignment-status.enum';
import { TimelineEventType } from '../enums/timeline-event-type.enum';
import { CreateDisputeDto, UpdateDisputeDto } from '../dto/dispute.dto';
import { ArbitratorSelectionService } from './arbitrator-selection.service';
import { EvidenceManagementService } from './evidence-management.service';
import { SmartContractIntegrationService } from './smart-contract-integration.service';
import { DisputeNotificationService } from './dispute-notification.service';

@Injectable()
export class DisputeResolutionService {
  private readonly logger = new Logger(DisputeResolutionService.name);

  constructor(
    @InjectRepository(DisputeCase)
    private disputeRepository: Repository<DisputeCase>,
    @InjectRepository(DisputeAssignment)
    private assignmentRepository: Repository<DisputeAssignment>,
    @InjectRepository(DisputeTimeline)
    private timelineRepository: Repository<DisputeTimeline>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
    private arbitratorSelection: ArbitratorSelectionService,
    private evidenceManagement: EvidenceManagementService,
    private smartContractIntegration: SmartContractIntegrationService,
    private notificationService: DisputeNotificationService,
  ) {}

  async createDispute(createDisputeDto: CreateDisputeDto): Promise<DisputeCase> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate unique case number
      const caseNumber = await this.generateCaseNumber();

      // Determine priority based on dispute type and amount
      const priority = this.calculatePriority(createDisputeDto);

      // Calculate deadlines
      const deadline = this.calculateDeadline(priority);
      const autoEscalationAt = this.calculateAutoEscalation(priority);

      const dispute = queryRunner.manager.create(DisputeCase, {
        ...createDisputeDto,
        caseNumber,
        priority,
        deadline,
        autoEscalationAt,
        status: DisputeStatus.OPEN,
        currentTier: 1,
      });

      const savedDispute = await queryRunner.manager.save(dispute);

      // Create initial timeline entry
      await this.addTimelineEvent(
        savedDispute.id,
        TimelineEventType.DISPUTE_CREATED,
        'Dispute case created',
        `Dispute case ${caseNumber} has been created and is pending arbitrator assignment`,
        createDisputeDto.initiatedBy,
        'user',
        { priority, deadline: deadline.toISOString() },
        queryRunner.manager,
      );

      // Auto-assign arbitrator for tier 1
      await this.assignArbitrator(savedDispute.id, 1, queryRunner.manager);

      await queryRunner.commitTransaction();

      // Emit event for external systems
      this.eventEmitter.emit('dispute.created', {
        disputeId: savedDispute.id,
        escrowId: savedDispute.escrowId,
        type: savedDispute.type,
        priority: savedDispute.priority,
      });

      this.logger.log(`Dispute case ${caseNumber} created successfully`);
      return savedDispute;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create dispute: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async assignArbitrator(
    disputeId: string,
    tier: number,
    manager?: any,
  ): Promise<DisputeAssignment> {
    const repository = manager || this.assignmentRepository;
    
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      relations: ['escrow'],
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Select appropriate arbitrator
    const arbitrator = await this.arbitratorSelection.selectArbitrator({
      disputeType: dispute.type,
      priority: dispute.priority,
      tier,
      escrowValue: dispute.disputedAmount,
    });

    if (!arbitrator) {
      throw new ConflictException('No available arbitrator found');
    }

    // Calculate assignment deadline
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + this.getAssignmentTimeoutHours(tier));

    const assignment = repository.create({
      disputeId,
      arbitratorId: arbitrator.id,
      tier,
      assignedAt: new Date(),
      deadline,
      status: AssignmentStatus.ASSIGNED,
    });

    const savedAssignment = await repository.save(assignment);

    // Add timeline event
    await this.addTimelineEvent(
      disputeId,
      TimelineEventType.ARBITRATOR_ASSIGNED,
      'Arbitrator assigned',
      `Arbitrator has been assigned to tier ${tier}`,
      null,
      'system',
      {
        arbitratorId: arbitrator.id,
        tier,
        deadline: deadline.toISOString(),
      },
      manager,
    );

    // Send notification to arbitrator
    await this.notificationService.notifyArbitratorAssignment(arbitrator.id, dispute);

    return savedAssignment;
  }

  async submitDecision(
    assignmentId: string,
    decision: {
      ruling: string;
      reasoning: string;
      compensation?: number;
      additionalActions?: string[];
    },
    arbitratorId: string,
  ): Promise<DisputeAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId, arbitratorId },
      relations: ['dispute'],
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.status !== AssignmentStatus.ACCEPTED) {
      throw new BadRequestException('Assignment must be accepted before submitting decision');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update assignment with decision
      assignment.decision = decision;
      assignment.status = AssignmentStatus.COMPLETED;
      assignment.completedAt = new Date();
      await queryRunner.manager.save(assignment);

      // Update dispute status
      const dispute = assignment.dispute;
      dispute.status = DisputeStatus.UNDER_REVIEW;
      await queryRunner.manager.save(dispute);

      // Add timeline event
      await this.addTimelineEvent(
        dispute.id,
        TimelineEventType.DECISION_MADE,
        'Arbitrator decision submitted',
        `Tier ${assignment.tier} arbitrator has submitted their decision`,
        arbitratorId,
        'arbitrator',
        { decision, tier: assignment.tier },
        queryRunner.manager,
      );

      // Check if this completes the dispute or needs escalation
      await this.processDecision(dispute.id, assignment.tier, queryRunner.manager);

      await queryRunner.commitTransaction();

      this.eventEmitter.emit('dispute.decision_submitted', {
        disputeId: dispute.id,
        assignmentId,
        tier: assignment.tier,
        decision,
      });

      return assignment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async escalateDispute(disputeId: string, reason: string): Promise<DisputeCase> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      relations: ['assignments'],
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.currentTier >= 3) {
      throw new BadRequestException('Dispute is already at maximum tier');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update dispute tier and status
      dispute.currentTier += 1;
      dispute.status = DisputeStatus.ESCALATED;
      await queryRunner.manager.save(dispute);

      // Add timeline event
      await this.addTimelineEvent(
        disputeId,
        TimelineEventType.ESCALATED,
        'Dispute escalated',
        `Dispute has been escalated to tier ${dispute.currentTier}. Reason: ${reason}`,
        null,
        'system',
        { newTier: dispute.currentTier, reason },
        queryRunner.manager,
      );

      // Assign new arbitrator for higher tier
      await this.assignArbitrator(disputeId, dispute.currentTier, queryRunner.manager);

      await queryRunner.commitTransaction();

      this.eventEmitter.emit('dispute.escalated', {
        disputeId,
        newTier: dispute.currentTier,
        reason,
      });

      return dispute;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async resolveDispute(
    disputeId: string,
    resolution: string,
    resolvedBy: string,
    executeSmartContract = true,
  ): Promise<DisputeCase> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      relations: ['assignments', 'escrow'],
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update dispute status
      dispute.status = DisputeStatus.RESOLVED;
      dispute.finalResolution = resolution;
      dispute.resolvedAt = new Date();
      dispute.resolvedBy = resolvedBy;
      await queryRunner.manager.save(dispute);

      // Add timeline event
      await this.addTimelineEvent(
        disputeId,
        TimelineEventType.RESOLVED,
        'Dispute resolved',
        'Dispute has been resolved and final decision implemented',
        resolvedBy,
        'arbitrator',
        { resolution },
        queryRunner.manager,
      );

      // Execute smart contract if requested
      if (executeSmartContract) {
        const contractResult = await this.smartContractIntegration.executeResolution(
          dispute,
          resolution,
        );
        
        if (contractResult) {
          dispute.smartContractData = contractResult;
          await queryRunner.manager.save(dispute);

          await this.addTimelineEvent(
            disputeId,
            TimelineEventType.SMART_CONTRACT_EXECUTED,
            'Smart contract executed',
            'Resolution has been executed on the blockchain',
            null,
            'system',
            contractResult,
            queryRunner.manager,
          );
        }
      }

      await queryRunner.commitTransaction();

      // Update arbitrator reputation
      await this.updateArbitratorReputation(dispute.assignments);

      this.eventEmitter.emit('dispute.resolved', {
        disputeId,
        escrowId: dispute.escrowId,
        resolution,
        smartContractExecuted: executeSmartContract,
      });

      return dispute;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Automated dispute detection
  @Cron(CronExpression.EVERY_HOUR)
  async detectAutomaticDisputes(): Promise<void> {
    this.logger.log('Running automatic dispute detection...');

    try {
      // Check for overdue milestones
      await this.detectOverdueMilestones();
      
      // Check for payment delays
      await this.detectPaymentDelays();
      
      // Check for communication gaps
      await this.detectCommunicationGaps();
      
      // Check for deadline violations
      await this.checkDeadlineViolations();
      
    } catch (error) {
      this.logger.error('Error in automatic dispute detection', error.stack);
    }
  }

  // Auto-escalation check
  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkAutoEscalation(): Promise<void> {
    const now = new Date();
    const disputesToEscalate = await this.disputeRepository.find({
      where: {
        autoEscalationAt: In([now]),
        status: In([DisputeStatus.OPEN, DisputeStatus.IN_PROGRESS]),
        currentTier: In([1, 2]),
      },
    });

    for (const dispute of disputesToEscalate) {
      try {
        await this.escalateDispute(
          dispute.id,
          'Automatic escalation due to timeout',
        );
        this.logger.log(`Auto-escalated dispute ${dispute.caseNumber}`);
      } catch (error) {
        this.logger.error(
          `Failed to auto-escalate dispute ${dispute.caseNumber}`,
          error.stack,
        );
      }
    }
  }

  private async generateCaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.disputeRepository.count({
      where: {
        caseNumber: Like(`DSP-${year}-%`),
      },
    });
    return `DSP-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private calculatePriority(createDisputeDto: CreateDisputeDto): DisputePriority {
    // Priority calculation logic based on dispute type, amount, etc.
    if (createDisputeDto.disputedAmount > 10000) {
      return DisputePriority.HIGH;
    }
    if (createDisputeDto.type === 'fraud') {
      return DisputePriority.URGENT;
    }
    return DisputePriority.MEDIUM;
  }

  private calculateDeadline(priority: DisputePriority): Date {
    const deadline = new Date();
    switch (priority) {
      case DisputePriority.URGENT:
        deadline.setHours(deadline.getHours() + 24);
        break;
      case DisputePriority.HIGH:
        deadline.setDate(deadline.getDate() + 3);
        break;
      case DisputePriority.MEDIUM:
        deadline.setDate(deadline.getDate() + 7);
        break;
      default:
        deadline.setDate(deadline.getDate() + 14);
    }
    return deadline;
  }

  private calculateAutoEscalation(priority: DisputePriority): Date {
    const escalation = new Date();
    switch (priority) {
      case DisputePriority.URGENT:
        escalation.setHours(escalation.getHours() + 12);
        break;
      case DisputePriority.HIGH:
        escalation.setDate(escalation.getDate() + 2);
        break;
      default:
        escalation.setDate(escalation.getDate() + 5);
    }
    return escalation;
  }

  private getAssignmentTimeoutHours(tier: number): number {
    switch (tier) {
      case 1: return 24;
      case 2: return 12;
      case 3: return 6;
      default: return 24;
    }
  }

  private async addTimelineEvent(
    disputeId: string,
    eventType: TimelineEventType,
    title: string,
    description: string,
    actorId: string | null,
    actorRole: string,
    eventData: Record<string, any>,
    manager?: any,
  ): Promise<void> {
    const repository = manager || this.timelineRepository;
    const timelineEvent = repository.create({
      disputeId,
      eventType,
      title,
      description,
      actorId,
      actorRole,
      eventData,
    });
    await repository.save(timelineEvent);
  }

  // ... additional helper methods for dispute detection and processing
}