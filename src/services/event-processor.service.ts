import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as CircuitBreaker from 'opossum';
import {
  BlockchainEvent,
  EventStatus,
} from '../models/blockchain-event.entity';
import { BlockchainEventService } from './blockchain-event.service';

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);
  private circuitBreaker: CircuitBreaker;

  constructor(
    private readonly eventService: BlockchainEventService,
    @InjectQueue('event-processing') private eventQueue: Queue,
  ) {
    this.initializeCircuitBreaker();
  }

  private initializeCircuitBreaker() {
    const options = {
      timeout: 30000, // 30 seconds
      errorThresholdPercentage: 50,
      resetTimeout: 60000, // 1 minute
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
    };

    this.circuitBreaker = new CircuitBreaker(
      this.processEventInternal.bind(this),
      options,
    );

    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker opened - event processing paused');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.log('Circuit breaker half-open - testing event processing');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.log('Circuit breaker closed - event processing resumed');
    });
  }

  @OnEvent('blockchain.event.created')
  async handleEventCreated(event: BlockchainEvent) {
    try {
      // Add event to processing queue
      await this.eventQueue.add(
        'process-event',
        { eventId: event.id },
        {
          attempts: event.maxRetries,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );

      this.logger.log(`Event ${event.id} queued for processing`);
    } catch (error) {
      this.logger.error('Failed to queue event for processing', error.stack);
    }
  }

  @OnEvent('blockchain.event.status.changed')
  async handleEventStatusChanged(data: {
    event: BlockchainEvent;
    previousStatus: EventStatus;
    newStatus: EventStatus;
  }) {
    const { event, previousStatus, newStatus } = data;

    this.logger.log(
      `Event ${event.id} status changed: ${previousStatus} -> ${newStatus}`,
    );

    // Handle specific status transitions
    if (newStatus === EventStatus.DEAD_LETTER) {
      await this.handleDeadLetterEvent(event);
    }
  }

  async processEvent(eventId: string): Promise<void> {
    try {
      await this.circuitBreaker.fire(eventId);
    } catch (error) {
      this.logger.error(
        `Circuit breaker rejected event ${eventId}`,
        error.stack,
      );
      throw error;
    }
  }

  private async processEventInternal(eventId: string): Promise<void> {
    const event = await this.eventService.getEventById(eventId);

    if (event.status !== EventStatus.PENDING) {
      this.logger.warn(`Event ${eventId} is not in pending status`);
      return;
    }

    // Mark as processing
    await this.eventService.updateEvent(eventId, {
      status: EventStatus.PROCESSING,
    });

    try {
      // Process based on event type
      await this.processEventByType(event);

      // Mark as processed
      await this.eventService.markAsProcessed(eventId);

      this.logger.log(`Successfully processed event ${eventId}`);
    } catch (error) {
      this.logger.error(`Failed to process event ${eventId}`, error.stack);
      await this.eventService.markAsFailed(eventId, error.message);
      throw error;
    }
  }

  private async processEventByType(event: BlockchainEvent): Promise<void> {
    switch (event.eventType) {
      case 'transfer':
        await this.processTransferEvent(event);
        break;
      case 'deposit':
        await this.processDepositEvent(event);
        break;
      case 'withdrawal':
        await this.processWithdrawalEvent(event);
        break;
      case 'stake':
        await this.processStakeEvent(event);
        break;
      case 'unstake':
        await this.processUnstakeEvent(event);
        break;
      case 'reward':
        await this.processRewardEvent(event);
        break;
      case 'governance':
        await this.processGovernanceEvent(event);
        break;
      default:
        throw new Error(`Unknown event type: ${event.eventType}`);
    }
  }

  private async processTransferEvent(event: BlockchainEvent): Promise<void> {
    // Implement transfer event processing logic
    this.logger.debug(`Processing transfer event: ${event.id}`);

    // Example: Update user balances, create transaction records, etc.
    const { from, to, amount } = event.decodedData;

    // Add your business logic here
    // await this.userService.updateBalance(from, -amount);
    // await this.userService.updateBalance(to, amount);
    // await this.transactionService.createTransaction(event);
  }

  private async processDepositEvent(event: BlockchainEvent): Promise<void> {
    this.logger.debug(`Processing deposit event: ${event.id}`);
    // Implement deposit processing logic
  }

  private async processWithdrawalEvent(event: BlockchainEvent): Promise<void> {
    this.logger.debug(`Processing withdrawal event: ${event.id}`);
    // Implement withdrawal processing logic
  }

  private async processStakeEvent(event: BlockchainEvent): Promise<void> {
    this.logger.debug(`Processing stake event: ${event.id}`);
    // Implement staking processing logic
  }

  private async processUnstakeEvent(event: BlockchainEvent): Promise<void> {
    this.logger.debug(`Processing unstake event: ${event.id}`);
    // Implement unstaking processing logic
  }

  private async processRewardEvent(event: BlockchainEvent): Promise<void> {
    this.logger.debug(`Processing reward event: ${event.id}`);
    // Implement reward processing logic
  }

  private async processGovernanceEvent(event: BlockchainEvent): Promise<void> {
    this.logger.debug(`Processing governance event: ${event.id}`);
    // Implement governance processing logic
  }

  private async handleDeadLetterEvent(event: BlockchainEvent): Promise<void> {
    this.logger.error(
      `Event ${event.id} moved to dead letter queue after ${event.retryCount} attempts`,
    );

    // Send alert/notification about failed event
    // await this.notificationService.sendAlert({
    //   type: 'DEAD_LETTER_EVENT',
    //   eventId: event.id,
    //   error: event.errorMessage,
    // });
  }

  // Manual retry for dead letter events
  async retryDeadLetterEvent(eventId: string): Promise<void> {
    const event = await this.eventService.getEventById(eventId);

    if (event.status !== EventStatus.DEAD_LETTER) {
      throw new Error('Event is not in dead letter status');
    }

    // Reset event for retry
    await this.eventService.updateEvent(eventId, {
      status: EventStatus.PENDING,
      retryCount: 0,
      errorMessage: null,
    });

    // Re-queue for processing
    await this.eventQueue.add('process-event', { eventId });

    this.logger.log(`Dead letter event ${eventId} queued for retry`);
  }
}
