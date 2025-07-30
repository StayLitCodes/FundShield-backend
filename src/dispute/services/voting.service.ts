import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vote } from '../entities/vote.entity';
import { Dispute } from '../entities/dispute.entity';
import { VoteDecision } from '../enums/vote.enum';
import { DisputeStatus } from '../enums/dispute.enum';
import { SubmitVoteDto, CommitVoteDto } from '../dto/vote.dto';
import { DisputeService } from './dispute.service';
import { ArbitratorService } from './arbitrator.service';
import * as crypto from 'crypto';

@Injectable()
export class VotingService {
  private readonly logger = new Logger(VotingService.name);

  constructor(
    @InjectRepository(Vote)
    private voteRepository: Repository<Vote>,
    @InjectRepository(Dispute)
    private disputeRepository: Repository<Dispute>,
    private disputeService: DisputeService,
    private arbitratorService: ArbitratorService,
  ) {}

  /**
   * Submit a vote (commit-reveal scheme)
   */
  async submitVote(dto: SubmitVoteDto): Promise<Vote> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: dto.disputeId },
    });

    if (!dispute) {
      throw new BadRequestException('Dispute not found');
    }

    if (dispute.status !== DisputeStatus.VOTING) {
      throw new BadRequestException('Dispute is not in voting phase');
    }

    // Check if arbitrator already voted
    const existingVote = await this.voteRepository.findOne({
      where: {
        disputeId: dto.disputeId,
        arbitratorId: dto.arbitratorId,
      },
    });

    if (existingVote) {
      throw new BadRequestException('Arbitrator has already voted');
    }

    // Create commit hash for vote
    const commitHash = this.createCommitHash(dto.decision, dto.reasoning, dto.nonce);

    const vote = this.voteRepository.create({
      disputeId: dto.disputeId,
      arbitratorId: dto.arbitratorId,
      decision: dto.decision,
      reasoning: dto.reasoning,
      weight: await this.calculateVoteWeight(dto.arbitratorId),
      commitHash,
      isCommitted: false,
      metadata: dto.metadata,
    });

    const savedVote = await this.voteRepository.save(vote);

    this.logger.log(`Vote submitted for dispute ${dto.disputeId} by arbitrator ${dto.arbitratorId}`);
    return savedVote;
  }

  /**
   * Commit vote (reveal phase)
   */
  async commitVote(dto: CommitVoteDto): Promise<Vote> {
    const vote = await this.voteRepository.findOne({
      where: {
        disputeId: dto.disputeId,
        arbitratorId: dto.arbitratorId,
      },
    });

    if (!vote) {
      throw new BadRequestException('Vote not found');
    }

    if (vote.isCommitted) {
      throw new BadRequestException('Vote already committed');
    }

    // Verify commit hash
    const expectedHash = this.createCommitHash(vote.decision, vote.reasoning, dto.nonce);
    if (expectedHash !== vote.commitHash) {
      throw new BadRequestException('Invalid commit hash');
    }

    vote.isCommitted = true;
    vote.committedAt = new Date();

    const committedVote = await this.voteRepository.save(vote);

    // Check if all votes are committed
    await this.checkVotingCompletion(dto.disputeId);

    this.logger.log(`Vote committed for dispute ${dto.disputeId} by arbitrator ${dto.arbitratorId}`);
    return committedVote;
  }

  /**
   * Get votes for a dispute
   */
  async getDisputeVotes(disputeId: string): Promise<Vote[]> {
    return this.voteRepository.find({
      where: { disputeId },
      relations: ['arbitrator', 'arbitrator.user'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Calculate vote results
   */
  async calculateVoteResults(disputeId: string): Promise<{
    decision: VoteDecision;
    totalWeight: number;
    voteBreakdown: Record<VoteDecision, number>;
    winningPercentage: number;
  }> {
    const votes = await this.voteRepository.find({
      where: { disputeId, isCommitted: true },
    });

    if (votes.length === 0) {
      throw new BadRequestException('No committed votes found');
    }

    const voteBreakdown: Record<VoteDecision, number> = {
      [VoteDecision.FAVOR_CLAIMANT]: 0,
      [VoteDecision.FAVOR_RESPONDENT]: 0,
      [VoteDecision.PARTIAL_CLAIMANT]: 0,
      [VoteDecision.PARTIAL_RESPONDENT]: 0,
      [VoteDecision.ABSTAIN]: 0,
      [VoteDecision.REQUIRE_MORE_EVIDENCE]: 0,
    };

    let totalWeight = 0;

    // Calculate weighted votes
    for (const vote of votes) {
      voteBreakdown[vote.decision] += vote.weight;
      totalWeight += vote.weight;
    }

    // Determine winning decision
    let winningDecision = VoteDecision.ABSTAIN;
    let maxWeight = 0;

    for (const [decision, weight] of Object.entries(voteBreakdown)) {
      if (weight > maxWeight) {
        maxWeight = weight;
        winningDecision = decision as VoteDecision;
      }
    }

    const winningPercentage = totalWeight > 0 ? (maxWeight / totalWeight) * 100 : 0;

    return {
      decision: winningDecision,
      totalWeight,
      voteBreakdown,
      winningPercentage,
    };
  }

  /**
   * Check if voting is complete and process results
   */
  private async checkVotingCompletion(disputeId: string): Promise<void> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      relations: ['votes'],
    });

    if (!dispute) return;

    const totalVotes = dispute.votes.length;
    const committedVotes = dispute.votes.filter(v => v.isCommitted).length;

    // Check if all arbitrators have committed their votes
    if (committedVotes === totalVotes && totalVotes > 0) {
      const results = await this.calculateVoteResults(disputeId);
      
      // Process the voting results
      await this.processVotingResults(dispute, results);
    }
  }

  /**
   * Process voting results and update dispute
   */
  private async processVotingResults(
    dispute: Dispute,
    results: {
      decision: VoteDecision;
      totalWeight: number;
      voteBreakdown: Record<VoteDecision, number>;
      winningPercentage: number;
    }
  ): Promise<void> {
    let resolution = '';
    let newStatus = DisputeStatus.RESOLVED;

    switch (results.decision) {
      case VoteDecision.FAVOR_CLAIMANT:
        resolution = `Dispute resolved in favor of claimant with ${results.winningPercentage.toFixed(1)}% of arbitrator votes.`;
        break;
      case VoteDecision.FAVOR_RESPONDENT:
        resolution = `Dispute resolved in favor of respondent with ${results.winningPercentage.toFixed(1)}% of arbitrator votes.`;
        break;
      case VoteDecision.PARTIAL_CLAIMANT:
        resolution = `Partial resolution in favor of claimant with ${results.winningPercentage.toFixed(1)}% of arbitrator votes.`;
        break;
      case VoteDecision.PARTIAL_RESPONDENT:
        resolution = `Partial resolution in favor of respondent with ${results.winningPercentage.toFixed(1)}% of arbitrator votes.`;
        break;
      case VoteDecision.REQUIRE_MORE_EVIDENCE:
        resolution = 'Arbitrators require more evidence before making a decision.';
        newStatus = DisputeStatus.EVIDENCE_COLLECTION;
        break;
      default:
        resolution = 'Dispute could not be resolved due to insufficient consensus.';
        break;
    }

    await this.disputeService.updateDisputeStatus(dispute.id, newStatus, {
      votingResults: results,
      resolution,
    });

    // Update arbitrator reputations
    await this.updateArbitratorReputations(dispute.id, results);
  }

  /**
   * Calculate vote weight based on arbitrator reputation and tier
   */
  private async calculateVoteWeight(arbitratorId: string): Promise<number> {
    const arbitrator = await this.arbitratorService.getArbitratorById(arbitratorId);
    
    let weight = 1.0; // Base weight
    
    // Adjust based on success rate
    weight *= (arbitrator.successRate / 100);
    
    // Adjust based on tier
    switch (arbitrator.tier) {
      case 'master':
        weight *= 2.0;
        break;
      case 'expert':
        weight *= 1.5;
        break;
      case 'senior':
        weight *= 1.2;
        break;
      default:
        weight *= 1.0;
    }
    
    return Math.max(0.1, Math.min(2.0, weight)); // Clamp between 0.1 and 2.0
  }

  /**
   * Create commit hash for vote
   */
  private createCommitHash(decision: VoteDecision, reasoning: string, nonce: string): string {
    const data = `${decision}:${reasoning}:${nonce}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Update arbitrator reputations based on voting results
   */
  private async updateArbitratorReputations(
    disputeId: string,
    results: any
  ): Promise<void> {
    const votes = await this.getDisputeVotes(disputeId);
    
    for (const vote of votes) {
      const isWinningVote = vote.decision === results.decision;
      await this.arbitratorService.updateReputation(
        vote.arbitratorId,
        isWinningVote ? 'positive' : 'negative'
      );
    }
  }
}