import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { DisputeController } from './controllers/dispute.controller';
import { ArbitratorController } from './controllers/arbitrator.controller';
import { EvidenceController } from './controllers/evidence.controller';
import { DisputeService } from './services/dispute.service';
import { ArbitratorService } from './services/arbitrator.service';
import { EvidenceService } from './services/evidence.service';
import { VotingService } from './services/voting.service';
import { DisputeResolutionService } from './services/dispute-resolution.service';
import { ArbitratorSelectionService } from './services/arbitrator-selection.service';
import { DisputeTimelineService } from './services/dispute-timeline.service';
import { AppealService } from './services/appeal.service';
import { IpfsService } from './services/ipfs.service';
import { SmartContractIntegrationService } from './services/smart-contract-integration.service';
import { DisputeProcessor } from './processors/dispute.processor';
import { Dispute } from './entities/dispute.entity';
import { Arbitrator } from './entities/arbitrator.entity';
import { Evidence } from './entities/evidence.entity';
import { Vote } from './entities/vote.entity';
import { Appeal } from './entities/appeal.entity';
import { DisputeTimeline } from './entities/dispute-timeline.entity';
import { ArbitratorReputation } from './entities/arbitrator-reputation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dispute,
      Arbitrator,
      Evidence,
      Vote,
      Appeal,
      DisputeTimeline,
      ArbitratorReputation,
    ]),
    ConfigModule,
    BullModule.registerQueue({
      name: 'dispute-processing',
    }),
  ],
  controllers: [
    DisputeController,
    ArbitratorController,
    EvidenceController,
  ],
  providers: [
    DisputeService,
    ArbitratorService,
    EvidenceService,
    VotingService,
    DisputeResolutionService,
    ArbitratorSelectionService,
    DisputeTimelineService,
    AppealService,
    IpfsService,
    SmartContractIntegrationService,
    DisputeProcessor,
  ],
  exports: [
    DisputeService,
    ArbitratorService,
    EvidenceService,
    VotingService,
    DisputeResolutionService,
  ],
})
export class DisputeModule {}