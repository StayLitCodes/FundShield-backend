import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Arbitrator } from '../entities/arbitrator.entity';
import { ArbitratorReputation } from '../entities/arbitrator-reputation.entity';
import { Dispute } from '../entities/dispute.entity';
import { ArbitratorStatus, ArbitratorTier } from '../enums/arbitrator.enum';
import { DisputeType, DisputePriority } from '../enums/dispute.enum';

@Injectable()
export class ArbitratorSelectionService {
  private readonly logger = new Logger(ArbitratorSelectionService.name);

  constructor(
    @InjectRepository(Arbitrator)
    private arbitratorRepository: Repository<Arbitrator>,
    @InjectRepository(ArbitratorReputation)
    private reputationRepository: Repository<ArbitratorReputation>,
  ) {}

  /**
   * Select arbitrators for a dispute
   */
  async selectArbitrators(dispute: Dispute): Promise<Arbitrator[]> {
    const requiredCount = this.getRequiredArbitratorCount(dispute);
    const requiredTier = this.getRequiredTier(dispute);

    // Get available arbitrators
    const availableArbitrators = await this.getAvailableArbitrators(requiredTier, dispute.type);

    if (availableArbitrators.length < requiredCount) {
      this.logger.warn(`Insufficient arbitrators available for dispute ${dispute.id}`);
      // Fallback to lower tier if needed
      const fallbackArbitrators = await this.getAvailableArbitrators(
        this.getLowerTier(requiredTier),
        dispute.type
      );
      availableArbitrators.push(...fallbackArbitrators);
    }

    // Score and select best arbitrators
    const scoredArbitrators = await this.scoreArbitrators(availableArbitrators, dispute);
    const selectedArbitrators = scoredArbitrators.slice(0, requiredCount);

    // Update arbitrator availability
    for (const arbitrator of selectedArbitrators) {
      await this.assignArbitratorToDispute(arbitrator.id, dispute.id);
    }

    this.logger.log(`Selected ${selectedArbitrators.length} arbitrators for dispute ${dispute.id}`);
    return selectedArbitrators;
  }

  /**
   * Get available arbitrators by tier and specialization
   */
  private async getAvailableArbitrators(
    tier: ArbitratorTier,
    disputeType: DisputeType
  ): Promise<Arbitrator[]> {
    const queryBuilder = this.arbitratorRepository
      .createQueryBuilder('arbitrator')
      .leftJoinAndSelect('arbitrator.reputation', 'reputation')
      .where('arbitrator.status = :status', { status: ArbitratorStatus.ACTIVE })
      .andWhere('arbitrator.isAvailable = :available', { available: true })
      .andWhere('arbitrator.activeCases < arbitrator.maxCases')
      .andWhere('arbitrator.tier >= :tier', { tier });

    // Filter by specialization if relevant
    if (disputeType !== DisputeType.OTHER) {
      queryBuilder.andWhere(
        'arbitrator.specializations LIKE :specialization OR arbitrator.specializations IS NULL',
        { specialization: `%${disputeType}%` }
      );
    }

    return queryBuilder.getMany();
  }

  /**
   * Score arbitrators based on various factors
   */
  private async scoreArbitrators(
    arbitrators: Arbitrator[],
    dispute: Dispute
  ): Promise<Arbitrator[]> {
    const scoredArbitrators = arbitrators.map(arbitrator => {
      let score = 0;

      // Base score from success rate
      score += arbitrator.successRate * 0.4;

      // Experience score
      const experienceScore = Math.min(arbitrator.totalCases / 100, 1) * 0.3;
      score += experienceScore;

      // Availability score (prefer less busy arbitrators)
      const availabilityScore = (1 - arbitrator.activeCases / arbitrator.maxCases) * 0.2;
      score += availabilityScore;

      // Tier bonus
      const tierBonus = this.getTierBonus(arbitrator.tier) * 0.1;
      score += tierBonus;

      // Specialization bonus
      if (arbitrator.specializations?.includes(dispute.type)) {
        score += 0.1;
      }

      // Recent activity bonus
      if (arbitrator.lastActiveAt && 
          Date.now() - arbitrator.lastActiveAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
        score += 0.05;
      }

      return { ...arbitrator, score };
    });

    // Sort by score (highest first)
    return scoredArbitrators.sort((a, b) => b.score - a.score);
  }

  /**
   * Assign arbitrator to dispute
   */
  private async assignArbitratorToDispute(arbitratorId: string, disputeId: string): Promise<void> {
    await this.arbitratorRepository.increment(
      { id: arbitratorId },
      'activeCases',
      1
    );

    await this.arbitratorRepository.update(
      { id: arbitratorId },
      { lastActiveAt: new Date() }
    );
  }

  /**
   * Get required number of arbitrators based on dispute characteristics
   */
  private getRequiredArbitratorCount(dispute: Dispute): number {
    if (dispute.disputeAmount > 100000) return 5; // High value disputes
    if (dispute.priority === DisputePriority.URGENT) return 3;
    if (dispute.type === DisputeType.FRAUD_CLAIM) return 3;
    return 1; // Default single arbitrator
  }

  /**
   * Get required arbitrator tier based on dispute characteristics
   */
  private getRequiredTier(dispute: Dispute): ArbitratorTier {
    if (dispute.disputeAmount > 50000 || dispute.type === DisputeType.FRAUD_CLAIM) {
      return ArbitratorTier.EXPERT;
    }
    if (dispute.disputeAmount > 10000 || dispute.priority === DisputePriority.HIGH) {
      return ArbitratorTier.SENIOR;
    }
    return ArbitratorTier.JUNIOR;
  }

  /**
   * Get lower tier for fallback
   */
  private getLowerTier(tier: ArbitratorTier): ArbitratorTier {
    switch (tier) {
      case ArbitratorTier.MASTER:
        return ArbitratorTier.EXPERT;
      case ArbitratorTier.EXPERT:
        return ArbitratorTier.SENIOR;
      case ArbitratorTier.SENIOR:
        return ArbitratorTier.JUNIOR;
      default:
        return ArbitratorTier.JUNIOR;
    }
  }

  /**
   * Get tier bonus for scoring
   */
  private getTierBonus(tier: ArbitratorTier): number {
    switch (tier) {
      case ArbitratorTier.MASTER:
        return 1.0;
      case ArbitratorTier.EXPERT:
        return 0.8;
      case ArbitratorTier.SENIOR:
        return 0.6;
      case ArbitratorTier.JUNIOR:
        return 0.4;
      default:
        return 0;
    }
  }
}