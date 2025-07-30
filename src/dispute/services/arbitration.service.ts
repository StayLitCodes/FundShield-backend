import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Arbitrator, ArbitratorStatus, ArbitratorTier } from '../entities/arbitrator.entity';
import { Dispute, DisputeType } from '../entities/dispute.entity';
import { ArbitratorSelectionService } from './arbitrator-selection.service';
import { ReputationService } from './reputation.service';

@Injectable()
export class ArbitrationService {
  private readonly logger = new Logger(ArbitrationService.name);

  constructor(
    @InjectRepository(Arbitrator)
    private arbitratorRepository: Repository<Arbitrator>,
    private arbitratorSelectionService: ArbitratorSelectionService,
    private reputationService: ReputationService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Select arbitrators for a dispute
   */
  async selectArbitrators(dispute: Dispute): Promise<Arbitrator[]> {
    try {
      const requiredArbitrators = this.getRequiredArbitratorCount(dispute);
      const selectedArbitrators = await this.arbitratorSelectionService.selectArbitrators(
        dispute,
        requiredArbitrators
      );

      // Update arbitrator case loads
      for (const arbitrator of selectedArbitrators) {
        arbitrator.currentCaseLoad += 1;
        await this.arbitratorRepository.save(arbitrator);
      }

      this.logger.log(`Selected ${selectedArbitrators.length} arbitrators for dispute ${dispute.id}`);
      return selectedArbitrators;
    } catch (error) {
      this.logger.error(`Error selecting arbitrators: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get available arbitrators for a dispute type
   */
  async getAvailableArbitrators(disputeType: DisputeType): Promise<Arbitrator[]> {
    return this.arbitratorRepository
      .createQueryBuilder('arbitrator')
      .where('arbitrator.status = :status', { status: ArbitratorStatus.ACTIVE })
      .andWhere('arbitrator.currentCaseLoad < arbitrator.maxConcurrentCases')
      .andWhere(
        'arbitrator.specializations IS NULL OR arbitrator.specializations = \'[]\' OR JSON_CONTAINS(arbitrator.specializations, :disputeType)',
        { disputeType: JSON.stringify(disputeType) }
      )
      .orderBy('arbitrator.reputationScore', 'DESC')
      .getMany();
  }

  /**
   * Complete arbitration case and update arbitrator stats
   */
  async completeArbitrationCase(
    arbitratorId: string,
    disputeId: string,
    successful: boolean,
    resolutionTime: number
  ): Promise<void> {
    const arbitrator = await this.arbitratorRepository.findOne({
      where: { id: arbitratorId },
    });

    if (!arbitrator) {
      throw new Error(`Arbitrator ${arbitratorId} not found`);
    }

    // Update statistics
    arbitrator.currentCaseLoad = Math.max(0, arbitrator.currentCaseLoad - 1);
    arbitrator.totalCases += 1;
    
    if (successful) {
      arbitrator.successfulResolutions += 1;
    }

    // Update average resolution time
    if (arbitrator.averageResolutionTime) {
      arbitrator.averageResolutionTime = 
        (arbitrator.averageResolutionTime * (arbitrator.totalCases - 1) + resolutionTime) / 
        arbitrator.totalCases;
    } else {
      arbitrator.averageResolutionTime = resolutionTime;
    }

    arbitrator.lastActive = new Date();

    await this.arbitratorRepository.save(arbitrator);

    // Update reputation score
    await this.reputationService.updateArbitratorReputation(arbitratorId, {
      caseCompleted: true,
      successful,
      resolutionTime,
    });

    this.logger.log(`Completed arbitration case for arbitrator ${arbitratorId}`);
  }

  /**
   * Get arbitrator performance metrics
   */
  async getArbitratorMetrics(arbitratorId: string): Promise<any> {
    const arbitrator = await this.arbitratorRepository.findOne({
      where: { id: arbitratorId },
      relations: ['votes'],
    });

    if (!arbitrator) {
      throw new Error(`Arbitrator ${arbitratorId} not found`);
    }

    const successRate = arbitrator.getSuccessRate();
    const totalVotes = arbitrator.votes?.length || 0;
    
    return {
      id: arbitrator.id,
      tier: arbitrator.tier,
      reputationScore: arbitrator.reputationScore,
      totalCases: arbitrator.totalCases,
      successfulResolutions: arbitrator.successfulResolutions,
      successRate,
      averageResolutionTime: arbitrator.averageResolutionTime,
      currentCaseLoad: arbitrator.currentCaseLoad,
      maxConcurrentCases: arbitrator.maxConcurrentCases,
      totalVotes,
      specializations: arbitrator.specializations,
      lastActive: arbitrator.lastActive,
    };
  }

  /**
   * Promote arbitrator to higher tier
   */
  async promoteArbitrator(arbitratorId: string): Promise<Arbitrator> {
    const arbitrator = await this.arbitratorRepository.findOne({
      where: { id: arbitratorId },
    });

    if (!arbitrator) {
      throw new Error(`Arbitrator ${arbitratorId} not found`);
    }

    const currentTier = arbitrator.tier;
    const nextTier = this.getNextTier(currentTier);

    if (!nextTier) {
      throw new Error(`Arbitrator is already at the highest tier`);
    }

    arbitrator.tier = nextTier;
    arbitrator.maxConcurrentCases = this.getMaxCasesForTier(nextTier);

    const updatedArbitrator = await this.arbitratorRepository.save(arbitrator);

    this.eventEmitter.emit('arbitrator.promoted', {
      arbitrator: updatedArbitrator,
      previousTier: currentTier,
      newTier: nextTier,
    });

    this.logger.log(`Arbitrator ${arbitratorId} promoted from ${currentTier} to ${nextTier}`);
    return updatedArbitrator;
  }

  /**
   * Private helper methods
   */
  private getRequiredArbitratorCount(dispute: Dispute): number {
    // Determine number of arbitrators based on dispute amount and type
    const amount = parseFloat(dispute.disputeAmount);
    
    if (amount > 100000) return 5; // High-value disputes
    if (amount > 10000) return 3;  // Medium-value disputes
    return 1; // Low-value disputes
  }

  private getNextTier(currentTier: ArbitratorTier): ArbitratorTier | null {
    const tierOrder = [
      ArbitratorTier.JUNIOR,
      ArbitratorTier.SENIOR,
      ArbitratorTier.EXPERT,
      ArbitratorTier.MASTER,
    ];

    const currentIndex = tierOrder.indexOf(currentTier);
    return currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;
  }

  private getMaxCasesForTier(tier: ArbitratorTier): number {
    const maxCases = {
      [ArbitratorTier.JUNIOR]: 3,
      [ArbitratorTier.SENIOR]: 5,
      [ArbitratorTier.EXPERT]: 8,
      [ArbitratorTier.MASTER]: 12,
    };

    return maxCases[tier];
  }
}