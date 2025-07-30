import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RpcProvider, Contract } from 'starknet';
import { BlockchainEventService } from './blockchain-event.service';
import { EventType } from '../models/blockchain-event.entity';
import { CreateBlockchainEventDto } from '../validators/blockchain-event.dto';

interface ContractConfig {
  address: string;
  abi: any[];
  events: {
    [eventName: string]: {
      type: EventType;
      decoder: (data: any) => any;
    };
  };
}

@Injectable()
export class BlockchainListenerService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainListenerService.name);
  private provider: RpcProvider;
  private contracts: Map<string, Contract> = new Map();
  private isListening = false;
  private lastProcessedBlock = 0;
  private readonly batchSize = 100;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventService: BlockchainEventService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeProvider();
  }

  async onModuleInit() {
    await this.initializeContracts();
    await this.startListening();
  }

  private initializeProvider() {
    const rpcUrl = this.configService.get<string>('STARKNET_RPC_URL');
    this.provider = new RpcProvider({ nodeUrl: rpcUrl });
    this.logger.log('Blockchain provider initialized');
  }

  private async initializeContracts() {
    // Define your contract configurations here
    const contractConfigs: ContractConfig[] = [
      {
        address: this.configService.get<string>('FUND_CONTRACT_ADDRESS'),
        abi: [], // Load your contract ABI
        events: {
          Transfer: {
            type: EventType.TRANSFER,
            decoder: this.decodeTransferEvent.bind(this),
          },
          Deposit: {
            type: EventType.DEPOSIT,
            decoder: this.decodeDepositEvent.bind(this),
          },
          Withdrawal: {
            type: EventType.WITHDRAWAL,
            decoder: this.decodeWithdrawalEvent.bind(this),
          },
        },
      },
      // Add more contracts as needed
    ];

    for (const config of contractConfigs) {
      if (config.address) {
        const contract = new Contract(
          config.abi,
          config.address,
          this.provider,
        );
        this.contracts.set(config.address, contract);
        this.logger.log(`Contract registered: ${config.address}`);
      }
    }
  }

  async startListening() {
    if (this.isListening) {
      this.logger.warn('Blockchain listener is already running');
      return;
    }

    this.isListening = true;
    this.lastProcessedBlock = await this.eventService.getLastProcessedBlock();
    this.logger.log(
      `Starting blockchain listener from block ${this.lastProcessedBlock}`,
    );

    // Start the initial sync
    await this.syncEvents();
  }

  stopListening() {
    this.isListening = false;
    this.logger.log('Blockchain listener stopped');
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async syncEvents() {
    if (!this.isListening) return;

    try {
      const latestBlock = await this.provider.getBlockNumber();

      if (this.lastProcessedBlock >= latestBlock) {
        return; // No new blocks to process
      }

      const fromBlock = this.lastProcessedBlock + 1;
      const toBlock = Math.min(fromBlock + this.batchSize - 1, latestBlock);

      this.logger.debug(`Syncing events from block ${fromBlock} to ${toBlock}`);

      await this.processBlockRange(fromBlock, toBlock);
      this.lastProcessedBlock = toBlock;

      // Emit sync progress event
      this.eventEmitter.emit('blockchain.sync.progress', {
        fromBlock,
        toBlock,
        latestBlock,
        progress: (toBlock / latestBlock) * 100,
      });
    } catch (error) {
      this.logger.error('Error syncing blockchain events', error.stack);
      // Implement exponential backoff here
      await this.delay(5000);
    }
  }

  private async processBlockRange(fromBlock: number, toBlock: number) {
    for (const [contractAddress, contract] of this.contracts) {
      try {
        // Get events for this contract in the block range
        const events = await this.getContractEvents(
          contractAddress,
          fromBlock,
          toBlock,
        );

        for (const event of events) {
          await this.processEvent(event, contractAddress);
        }
      } catch (error) {
        this.logger.error(
          `Error processing events for contract ${contractAddress}`,
          error.stack,
        );
      }
    }
  }

  private async getContractEvents(
    contractAddress: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<any[]> {
    // Implement event fetching logic based on Starknet.js v5.24.3
    try {
      const filter = {
        from_block: { block_number: fromBlock },
        to_block: { block_number: toBlock },
        address: contractAddress,
        keys: [], // Add event keys/selectors here
        chunk_size: 1000, // Required property for RESULT_PAGE_REQUEST
      };

      const response = await this.provider.getEvents(filter);
      return response.events || [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch events for contract ${contractAddress}`,
        error.stack,
      );
      return [];
    }
  }

  private async processEvent(event: any, contractAddress: string) {
    try {
      const eventDto = await this.parseEvent(event, contractAddress);
      if (eventDto) {
        await this.eventService.createEvent(eventDto);
      }
    } catch (error) {
      this.logger.error('Error processing individual event', error.stack);
    }
  }

  private async parseEvent(
    event: any,
    contractAddress: string,
  ): Promise<CreateBlockchainEventDto | null> {
    try {
      // Parse the raw event data
      const eventName = this.getEventName(event);
      const eventType = this.getEventType(eventName);

      if (!eventType) {
        this.logger.warn(`Unknown event type for event: ${eventName}`);
        return null;
      }

      const decodedData = await this.decodeEventData(event, eventName);

      return {
        transactionHash: event.transaction_hash,
        blockHash: event.block_hash,
        blockNumber: event.block_number,
        contractAddress,
        eventName,
        eventType,
        eventData: event.data,
        decodedData,
        metadata: {
          eventIndex: event.event_index,
          keys: event.keys,
        },
      };
    } catch (error) {
      this.logger.error('Error parsing event', error.stack);
      return null;
    }
  }

  private getEventName(event: any): string {
    // Implement event name extraction logic based on event keys
    // This depends on your contract's event structure
    return 'Unknown';
  }

  private getEventType(eventName: string): EventType | null {
    const eventTypeMap: Record<string, EventType> = {
      Transfer: EventType.TRANSFER,
      Deposit: EventType.DEPOSIT,
      Withdrawal: EventType.WITHDRAWAL,
      Stake: EventType.STAKE,
      Unstake: EventType.UNSTAKE,
      Reward: EventType.REWARD,
      GovernanceVote: EventType.GOVERNANCE,
    };

    return eventTypeMap[eventName] || null;
  }

  private async decodeEventData(event: any, eventName: string): Promise<any> {
    // Implement event data decoding based on your contract ABI
    // This is where you'll decode the raw event data into meaningful values
    return {
      raw: event.data,
      decoded: {}, // Add decoded fields here
    };
  }

  // Event decoder methods
  private decodeTransferEvent(data: any): any {
    return {
      from: data[0],
      to: data[1],
      amount: data[2],
    };
  }

  private decodeDepositEvent(data: any): any {
    return {
      user: data[0],
      amount: data[1],
      token: data[2],
    };
  }

  private decodeWithdrawalEvent(data: any): any {
    return {
      user: data[0],
      amount: data[1],
      token: data[2],
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Handle blockchain reorganizations
  async handleReorganization(newChainHead: number) {
    this.logger.warn(
      `Blockchain reorganization detected at block ${newChainHead}`,
    );

    // Revert events from the reorganized blocks
    // This is a simplified implementation
    this.lastProcessedBlock = Math.min(
      this.lastProcessedBlock,
      newChainHead - 10,
    );

    // Emit reorganization event
    this.eventEmitter.emit('blockchain.reorganization', {
      newChainHead,
      revertedToBlock: this.lastProcessedBlock,
    });
  }
}
