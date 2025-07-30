import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, RpcProvider } from 'starknet';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Dispute } from '../entities/dispute.entity';

@Injectable()
export class SmartContractIntegrationService {
  private readonly logger = new Logger(SmartContractIntegrationService.name);
  private readonly provider: RpcProvider;
  private readonly arbitrationContract: Contract;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    const rpcUrl = this.configService.get<string>('STARKNET_RPC_URL');
    this.provider = new RpcProvider({ nodeUrl: rpcUrl });
    
    const contractAddress = this.configService.get<string>('ARBITRATION_CONTRACT_ADDRESS');
    const contractAbi = this.getArbitrationContractAbi();
    
    this.arbitrationContract = new Contract(contractAbi, contractAddress, this.provider);
  }

  /**
   * Execute dispute resolution on smart contract
   */
  async executeResolution(dispute: Dispute, resolution: any): Promise<string> {
    try {
      this.logger.log(`Executing resolution for dispute ${dispute.id} on smart contract`);

      const txData = {
        escrow_id: dispute.escrowId,
        dispute_id: dispute.id,
        resolution_type: this.mapResolutionType(resolution.decision),
        amount: resolution.amount,
        recipient: resolution.recipient,
      };

      // Call smart contract function
      const result = await this.arbitrationContract.execute_resolution(txData);
      
      const txHash = result.transaction_hash;

      // Wait for transaction confirmation
      await this.provider.waitForTransaction(txHash);

      this.eventEmitter.emit('resolution.executed', {
        dispute,
        resolution,
        txHash,
      });

      this.logger.log(`Resolution executed successfully. TX Hash: ${txHash}`);
      return txHash;
    } catch (error) {
      this.logger.error(`Error executing resolution on smart contract: ${error.message}`);
      throw error;
    }