import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BlockchainEventService } from './blockchain-event.service';
import {
  BlockchainEvent,
  EventStatus,
  EventType,
} from '../models/blockchain-event.entity';

describe('BlockchainEventService', () => {
  let service: BlockchainEventService;
  let repository: Repository<BlockchainEvent>;
  let eventEmitter: EventEmitter2;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainEventService,
        {
          provide: getRepositoryToken(BlockchainEvent),
          useValue: mockRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<BlockchainEventService>(BlockchainEventService);
    repository = module.get<Repository<BlockchainEvent>>(
      getRepositoryToken(BlockchainEvent),
    );
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createEvent', () => {
    it('should create a new blockchain event', async () => {
      const createEventDto = {
        transactionHash: '0x123',
        blockHash: '0x456',
        blockNumber: 12345,
        contractAddress: '0x789',
        eventName: 'Transfer',
        eventType: EventType.TRANSFER,
        eventData: { from: '0xabc', to: '0xdef', amount: '1000' },
      };

      const savedEvent = {
        id: 'uuid-123',
        ...createEventDto,
        status: EventStatus.PENDING,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(savedEvent);
      mockRepository.save.mockResolvedValue(savedEvent);

      const result = await service.createEvent(createEventDto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          transactionHash: createEventDto.transactionHash,
          contractAddress: createEventDto.contractAddress,
          eventName: createEventDto.eventName,
        },
      });
      expect(repository.create).toHaveBeenCalledWith(createEventDto);
      expect(repository.save).toHaveBeenCalledWith(savedEvent);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'blockchain.event.created',
        savedEvent,
      );
      expect(result).toEqual(savedEvent);
    });

    it('should return existing event if duplicate detected', async () => {
      const createEventDto = {
        transactionHash: '0x123',
        blockHash: '0x456',
        blockNumber: 12345,
        contractAddress: '0x789',
        eventName: 'Transfer',
        eventType: EventType.TRANSFER,
        eventData: { from: '0xabc', to: '0xdef', amount: '1000' },
      };

      const existingEvent = {
        id: 'existing-uuid',
        ...createEventDto,
        status: EventStatus.PROCESSED,
      };

      mockRepository.findOne.mockResolvedValue(existingEvent);

      const result = await service.createEvent(createEventDto);

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
      expect(result).toEqual(existingEvent);
    });
  });

  describe('markAsFailed', () => {
    it('should mark event as failed and increment retry count', async () => {
      const eventId = 'test-id';
      const errorMessage = 'Processing failed';
      const existingEvent = {
        id: eventId,
        retryCount: 1,
        maxRetries: 3,
        status: EventStatus.PROCESSING,
      };

      mockRepository.findOne.mockResolvedValue(existingEvent);
      mockRepository.save.mockResolvedValue({
        ...existingEvent,
        retryCount: 2,
        status: EventStatus.FAILED,
        errorMessage,
      });

      await service.markAsFailed(eventId, errorMessage);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          retryCount: 2,
          status: EventStatus.FAILED,
          errorMessage,
        }),
      );
    });

    it('should mark event as dead letter when max retries exceeded', async () => {
      const eventId = 'test-id';
      const errorMessage = 'Processing failed';
      const existingEvent = {
        id: eventId,
        retryCount: 2,
        maxRetries: 3,
        status: EventStatus.PROCESSING,
      };

      mockRepository.findOne.mockResolvedValue(existingEvent);
      mockRepository.save.mockResolvedValue({
        ...existingEvent,
        retryCount: 3,
        status: EventStatus.DEAD_LETTER,
        errorMessage,
      });

      await service.markAsFailed(eventId, errorMessage);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          retryCount: 3,
          status: EventStatus.DEAD_LETTER,
          errorMessage,
        }),
      );
    });
  });
});
