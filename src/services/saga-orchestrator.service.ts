import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  Transaction,
  SagaStep,
  TransactionStatus,
  SagaStepStatus,
  TransactionType,
} from '../models/transaction.entity';
import { CreateTransactionDto, SagaStepDto } from '../validators/transaction.dto';
import { v4 as uuidv4 } from 'uuid';

export interface SagaDefinition {
  steps: SagaStepDefinition[];
}

export interface SagaStepDefinition {
  name: string;
  order: number;
  handler: string;
  compensationHandler?: string;
  timeout?: number;
  retryable?: boolean;
  maxRetries?: number;
}

@Injectable()
export class SagaOrchestratorService {
  private readonly logger = new Logger(SagaOrchestratorService.name);
  private readonly sagaDefinitions = new Map<TransactionType, SagaDefinition>();

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(SagaStep)
    private readonly sagaStepRepository: Repository<SagaStep>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('saga-processing') private sagaQueue: Queue,
  ) {
    this.initializeSagaDefinitions();
  }

  private initializeSagaDefinitions() {
    // Define saga steps for different transaction types
    this.sagaDefinitions.set(TransactionType.DEPOSIT, {
      steps: [
        {
          name: 'validate-deposit',
          order: 1,
          handler: 'validateDepositStep',
          compensationHandler: 'compensateValidateDeposit',
          timeout: 30000,
          retryable: true,
          maxRetries: 3,
        },
        {
          name: 'reserve-funds',
          order: 2,
          handler: 'reserveFundsStep',
          compensationHandler: 'compensateReserveFunds',
          timeout: 60000,
          retryable: true,
          maxRetries: 3,
        },
        {
          name: 'execute-blockchain-transaction',
          order: 3,
          handler: 'executeBlockchainTransactionStep',
          compensationHandler: 'compensateBlockchainTransaction',
          timeout: 300000,
          retryable: true,
          maxRetries: 5,
        },
        {
          name: 'update-user-balance',
          order: 4,
          handler: 'updateUserBalanceStep',
          compensationHandler: 'compensateUserBalance',
          timeout: 30000,
          retryable: true,
          maxRetries: 3,
        },
        {
          name: 'send-notification',
          order: 5,
          handler: 'sendNotificationStep',
          compensationHandler: 'compensateNotification',
          timeout: 30000,
          retryable: false,
        },
      ],
    });

    this.sagaDefinitions.set(TransactionType.WITHDRAWAL, {
      steps: [
        {
          name: 'validate-withdrawal',
          order: 1,
          handler: 'validateWithdrawalStep',
          compensationHandler: 'compensateValidateWithdrawal',
        },
        {
          name: 'check-balance',
          order: 2,
          handler: 'checkBalanceStep',
          compensationHandler: 'compensateCheckBalance',
        },
        {
          name: 'lock-funds',
          order: 3,
          handler: 'lockFundsStep',
          compensationHandler: 'compensateLockFunds',
        },
        {
          name: 'execute-blockchain-withdrawal',
          order: 4,
          handler: 'executeBlockchainWithdrawalStep',
          compensationHandler: 'compensateBlockchainWithdrawal',
        },
        {
          name: 'update-user-balance',
          order: 5,
          handler: 'updateUserBalanceStep',
          compensationHandler: 'compensateUserBalance',
        },
      ],
    });

    // Add more saga definitions for other transaction types
  }

  async startSaga(
    createTransactionDto: CreateTransactionDto,
  ): Promise<Transaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check for existing transaction with same idempotency key
      const existingTransaction = await this.transactionRepository.findOne({
        where: { idempotencyKey: createTransactionDto.idempotencyKey },
      });

      if (existingTransaction) {
        this.logger.warn(
          `Duplicate transaction detected: ${createTransactionDto.idempotencyKey}`,
        );
        await queryRunner.rollbackTransaction();
        return existingTransaction;
      }

      const sagaId = uuidv4();
      const transaction = this.transactionRepository.create({
        ...createTransactionDto,
        sagaId,
        status: TransactionStatus.PENDING,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // Create saga steps
      const sagaDefinition = this.sagaDefinitions.get(
        createTransactionDto.transactionType,
      );

      if (!sagaDefinition) {
        throw new Error(
          `No saga definition found for transaction type: ${createTransactionDto.transactionType}`,
        );
      }

      const sagaSteps = sagaDefinition.steps.map(stepDef => {
        return this.sagaStepRepository.create({
          transactionId: savedTransaction.id,
          stepName: stepDef.name,
          stepOrder: stepDef.order,
          status: SagaStepStatus.PENDING,
          stepData: {},
        });
      });

      await queryRunner.manager.save(sagaSteps);
      await queryRunner.commitTransaction();

      // Start saga execution
      await this.sagaQueue.add(
        'execute-saga',
        { transactionId: savedTransaction.id },
        {
          attempts: 1,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.eventEmitter.emit('saga.started', {
        sagaId,
        transactionId: savedTransaction.id,
        transactionType: createTransactionDto.transactionType,
      });

      this.logger.log(
        `Saga started: ${sagaId} for transaction: ${savedTransaction.id}`,
      );

      return savedTransaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to start saga', error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async executeSaga(transactionId: string): Promise<void> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      relations: ['sagaSteps'],
    });

    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const sortedSteps = transaction.sagaSteps.sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );

    try {
      await this.updateTransactionStatus(
        transactionId,
        TransactionStatus.PROCESSING,
      );

      for (const step of sortedSteps) {
        if (step.status === SagaStepStatus.COMPLETED) {
          continue; // Skip already completed steps
        }

        await this.executeStep(step, transaction);
      }

      await this.updateTransactionStatus(
        transactionId,
        TransactionStatus.COMPLETED,
      );

      this.eventEmitter.emit('saga.completed', {
        sagaId: transaction.sagaId,
        transactionId,
      });

      this.logger.log(`Saga completed: ${transaction.sagaId}`);
    } catch (error) {
      this.logger.error(
        `Saga execution failed: ${transaction.sagaId}`,
        error.stack,
      );
      await this.compensateSaga(transaction);
    }
  }

  private async executeStep(
    step: SagaStep,
    transaction: Transaction,
  ): Promise<void> {
    try {
      await this.updateStepStatus(step.id, SagaStepStatus.PENDING);
      step.startedAt = new Date();
      await this.sagaStepRepository.save(step);

      // Execute the step handler
      await this.sagaQueue.add(
        'execute-step',
        {
          stepId: step.id,
          transactionId: transaction.id,
          stepName: step.stepName,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.logger.debug(
        `Step queued: ${step.stepName} for transaction: ${transaction.id}`,
      );
    } catch (error) {
      await this.updateStepStatus(
        step.id,
        SagaStepStatus.FAILED,
        error.message,
      );
      throw error;
    }
  }

  async compensateSaga(transaction: Transaction): Promise<void> {
    try {
      await this.updateTransactionStatus(
        transaction.id,
        TransactionStatus.COMPENSATING,
      );

      const completedSteps = transaction.sagaSteps
        .filter(step => step.status === SagaStepStatus.COMPLETED)
        .sort((a, b) => b.stepOrder - a.stepOrder); // Reverse order for compensation

      for (const step of completedSteps) {
        await this.compensateStep(step, transaction);
      }

      await this.updateTransactionStatus(
        transaction.id,
        TransactionStatus.COMPENSATED,
      );

      this.eventEmitter.emit('saga.compensated', {
        sagaId: transaction.sagaId,
        transactionId: transaction.id,
      });

      this.logger.log(`Saga compensated: ${transaction.sagaId}`);
    } catch (error) {
      await this.updateTransactionStatus(
        transaction.id,
        TransactionStatus.FAILED,
      );
      this.logger.error(
        `Saga compensation failed: ${transaction.sagaId}`,
        error.stack,
      );
      throw error;
    }
  }

  private async compensateStep(
    step: SagaStep,
    transaction: Transaction,
  ): Promise<void> {
    try {
      await this.sagaQueue.add(
        'compensate-step',
        {
          stepId: step.id,
          transactionId: transaction.id,
          stepName: step.stepName,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.logger.debug(
        `Compensation queued: ${step.stepName} for transaction: ${transaction.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to compensate step: ${step.stepName}`,
        error.stack,
      );
      throw error;
    }
  }

  private async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
  ): Promise<void> {
    await this.transactionRepository.update(transactionId, {
      status,
      updatedAt: new Date(),
    });
  }

  private async updateStepStatus(
    stepId: string,
    status: SagaStepStatus,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: Partial<SagaStep> = {
      status,
      updatedAt: new Date(),
    };

    if (status === SagaStepStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await this.sagaStepRepository.update(stepId, updateData);
  }

  async getSagaStatus(sagaId: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { sagaId },
      relations: ['sagaSteps'],
    });

    if (!transaction) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    return transaction;
  }

  async retryFailedSaga(transactionId: string): Promise<void> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
      relations: ['sagaSteps'],
    });

    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.retryCount >= transaction.maxRetries) {
      throw new Error(`Maximum retry attempts exceeded for transaction: ${transactionId}`);
    }

    await this.transactionRepository.update(transactionId, {
      retryCount: transaction.retryCount + 1,
      status: TransactionStatus.PENDING,
    });

    // Reset failed steps to pending
    await this.sagaStepRepository.update(
      { transactionId, status: SagaStepStatus.FAILED },
      { status: SagaStepStatus.PENDING, errorMessage: null },
    );

    await this.executeSaga(transactionId);
  }
}