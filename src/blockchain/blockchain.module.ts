import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BlockchainEvent } from '../models/blockchain-event.entity';
import { BlockchainEventService } from '../services/blockchain-event.service';
import { BlockchainListenerService } from '../services/blockchain-listener.service';
import { EventProcessorService } from '../services/event-processor.service';
import { EventQueueProcessor } from '../services/event-queue.processor';
import { BlockchainController } from '../controllers/blockchain.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlockchainEvent]),
    BullModule.registerQueue({
      name: 'event-processing',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
  ],
  controllers: [BlockchainController],
  providers: [
    BlockchainEventService,
    BlockchainListenerService,
    EventProcessorService,
    EventQueueProcessor,
  ],
  exports: [
    BlockchainEventService,
    BlockchainListenerService,
    EventProcessorService,
  ],
})
export class BlockchainModule {}
