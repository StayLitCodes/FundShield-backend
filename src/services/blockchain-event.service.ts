import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BlockchainEvent,
  EventStatus,
  EventType,
} from '../models/blockchain-event.entity';
import {
  CreateBlockchainEventDto,
  UpdateBlockchainEventDto,
  EventFilterDto,
} from '../validators/blockchain-event.dto';

@Injectable()
export class BlockchainEventService {
  private readonly logger = new Logger(BlockchainEventService.name);

  constructor(
    @InjectRepository(BlockchainEvent)
    private readonly eventRepository: Repository<BlockchainEvent>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createEvent(
    createEventDto: CreateBlockchainEventDto,
  ): Promise<BlockchainEvent> {
    try {
      // Check for duplicate events
      const existingEvent = await this.eventRepository.findOne({
        where: {
          transactionHash: createEventDto.transactionHash,
          contractAddress: createEventDto.contractAddress,
          eventName: createEventDto.eventName,
        },
      });

      if (existingEvent) {
        this.logger.warn(
          `Duplicate event detected: ${createEventDto.transactionHash}`,
        );
        return existingEvent;
      }

      const event = this.eventRepository.create(createEventDto);
      const savedEvent = await this.eventRepository.save(event);

      // Emit event for processing
      this.eventEmitter.emit('blockchain.event.created', savedEvent);

      this.logger.log(
        `Created blockchain event: ${savedEvent.id} - ${savedEvent.eventType}`,
      );

      return savedEvent;
    } catch (error) {
      this.logger.error('Failed to create blockchain event', error.stack);
      throw error;
    }
  }

  async updateEvent(
    id: string,
    updateEventDto: UpdateBlockchainEventDto,
  ): Promise<BlockchainEvent> {
    const event = await this.eventRepository.findOne({ where: { id } });
    if (!event) {
      throw new Error(`Event with id ${id} not found`);
    }

    Object.assign(event, updateEventDto);
    const updatedEvent = await this.eventRepository.save(event);

    // Emit status change event
    if (updateEventDto.status) {
      this.eventEmitter.emit('blockchain.event.status.changed', {
        event: updatedEvent,
        previousStatus: event.status,
        newStatus: updateEventDto.status,
      });
    }

    return updatedEvent;
  }

  async findEvents(filter: EventFilterDto): Promise<{
    events: BlockchainEvent[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...filterOptions } = filter;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<BlockchainEvent> = {};

    if (filterOptions.contractAddress) {
      where.contractAddress = filterOptions.contractAddress;
    }
    if (filterOptions.eventType) {
      where.eventType = filterOptions.eventType;
    }
    if (filterOptions.status) {
      where.status = filterOptions.status;
    }
    if (filterOptions.fromBlock && filterOptions.toBlock) {
      where.blockNumber = Between(
        filterOptions.fromBlock,
        filterOptions.toBlock,
      );
    } else if (filterOptions.fromBlock) {
      where.blockNumber = Between(
        filterOptions.fromBlock,
        Number.MAX_SAFE_INTEGER,
      );
    } else if (filterOptions.toBlock) {
      where.blockNumber = Between(0, filterOptions.toBlock);
    }

    const [events, total] = await this.eventRepository.findAndCount({
      where,
      order: { blockNumber: 'DESC', createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { events, total, page, limit };
  }

  async getEventById(id: string): Promise<BlockchainEvent> {
    const event = await this.eventRepository.findOne({ where: { id } });
    if (!event) {
      throw new Error(`Event with id ${id} not found`);
    }
    return event;
  }

  async getFailedEvents(): Promise<BlockchainEvent[]> {
    return this.eventRepository.find({
      where: { status: EventStatus.FAILED },
      order: { lastRetryAt: 'ASC' },
    });
  }

  async getPendingEvents(): Promise<BlockchainEvent[]> {
    return this.eventRepository.find({
      where: { status: EventStatus.PENDING },
      order: { blockNumber: 'ASC', createdAt: 'ASC' },
    });
  }

  async markAsProcessed(id: string): Promise<void> {
    await this.updateEvent(id, {
      status: EventStatus.PROCESSED,
      processedAt: new Date(),
    });
  }

  async markAsFailed(id: string, errorMessage: string): Promise<void> {
    const event = await this.getEventById(id);
    const newRetryCount = event.retryCount + 1;
    const status =
      newRetryCount >= event.maxRetries
        ? EventStatus.DEAD_LETTER
        : EventStatus.FAILED;

    await this.updateEvent(id, {
      status,
      errorMessage,
      retryCount: newRetryCount,
      lastRetryAt: new Date(),
    });
  }

  async getLastProcessedBlock(): Promise<number> {
    const lastEvent = await this.eventRepository.findOne({
      where: { status: EventStatus.PROCESSED },
      order: { blockNumber: 'DESC' },
    });
    return lastEvent?.blockNumber || 0;
  }

  async deleteOldEvents(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await this.eventRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .andWhere('status = :status', { status: EventStatus.PROCESSED })
      .execute();

    this.logger.log(`Deleted processed events older than ${daysOld} days`);
  }
}
