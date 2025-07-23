import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../models/transaction.entity';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  TransactionFilterDto,
} from '../validators/transaction.dto';
import { SagaOrchestratorService } from './saga-orchestrator.service';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly sagaOrchestrator: SagaOrchestratorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTransaction(
    createTransactionDto: CreateTransactionDto,
  ): Promise<Transaction> {
    try {
      const transaction = await this.sagaOrchestrator.startSaga(
        createTransactionDto,
      );

      this.logger.log(
        `Transaction created: ${transaction.id} - ${transaction.transactionType}`,
      );

      return transaction;
    } catch (error) {
      this.logger.error('Failed to create transaction', error.stack);
      throw error;
    }
  }

  async updateTransaction(
    id: string,
    updateTransactionDto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
    });

    if (!transaction) {
      throw new Error(`Transaction with id ${id} not found`);
    }

    Object.assign(transaction, updateTransactionDto);
    const updatedTransaction = await this.transactionRepository.save(
      transaction,
    );

    // Emit status change event
    if (updateTransactionDto.status) {
      this.eventEmitter.emit('transaction.status.changed', {
        transaction: updatedTransaction,
        previousStatus: transaction.status,
        newStatus: updateTransactionDto.status,
      });
    }

    return updatedTransaction;
  }

  async findTransactions(filter: TransactionFilterDto): Promise<{
    transactions: Transaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, ...filterOptions } = filter;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Transaction> = {};

    if (filterOptions.userId) {
      where.userId = filterOptions.userId;
    }
    if (filterOptions.transactionType) {
      where.transactionType = filterOptions.transactionType;
    }
    if (filterOptions.status) {
      where.status = filterOptions.status;
    }
    if (filterOptions.fromDate && filterOptions.toDate) {
      where.createdAt = Between(filterOptions.fromDate, filterOptions.toDate);
    }

    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where,
        relations: ['sagaSteps'],
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      },
    );

    return { transactions, total, page, limit };
  }

  async getTransactionById(id: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: ['sagaSteps'],
    });

    if (!transaction) {
      throw new Error(`Transaction with id ${id} not found`);
    }

    return transaction;
  }

  async getTransactionByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: { idempotencyKey },
      relations: ['sagaSteps'],
    });
  }

  async getFailedTransactions(): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: { status: TransactionStatus.FAILED },
      relations: ['sagaSteps'],
      order: { updatedAt: 'ASC' },
    });
  }

  async getPendingTransactions(): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: { status: TransactionStatus.PENDING },
      relations: ['sagaSteps'],
      order: { createdAt: 'ASC' },
    });
  }

  async retryTransaction(id: string): Promise<void> {
    await this.sagaOrchestrator.retryFailedSaga(id);
    this.logger.log(`Transaction retry initiated: ${id}`);
  }

  async cancelTransaction(id: string): Promise<void> {
    const transaction = await this.getTransactionById(id);

    if (
      transaction.status === TransactionStatus.COMPLETED ||
      transaction.status === TransactionStatus.COMPENSATED
    ) {
      throw new Error(
        `Cannot cancel transaction in status: ${transaction.status}`,
      );
    }

    await this.updateTransaction(id, {
      status: TransactionStatus.CANCELLED,
    });

    this.eventEmitter.emit('transaction.cancelled', { transactionId: id });
    this.logger.log(`Transaction cancelled: ${id}`);
  }

  async getTransactionStats(userId?: string): Promise<{
    total: number;
    pending: number;
    completed: number;
    failed: number;
    totalVolume: string;
  }> {
    const where: FindOptionsWhere<Transaction> = {};
    if (userId) {
      where.userId = userId;
    }

    const [total, pending, completed, failed] = await Promise.all([
      this.transactionRepository.count({ where }),
      this.transactionRepository.count({
        where: { ...where, status: TransactionStatus.PENDING },
      }),
      this.transactionRepository.count({
        where: { ...where, status: TransactionStatus.COMPLETED },
      }),
      this.transactionRepository.count({
        where: { ...where, status: TransactionStatus.FAILED },
      }),
    ]);

    // Calculate total volume
    const volumeResult = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(CAST(transaction.amount AS DECIMAL))', 'totalVolume')
      .where(where)
      .andWhere('transaction.status = :status', {
        status: TransactionStatus.COMPLETED,
      })
      .getRawOne();

    return {
      total,
      pending,
      completed,
      failed,
      totalVolume: volumeResult?.totalVolume || '0',
    };
  }

  async cleanupExpiredTransactions(): Promise<void> {
    const expiredTransactions = await this.transactionRepository.find({
      where: {
        status: TransactionStatus.PENDING,
        expiresAt: Between(new Date(0), new Date()),
      },
    });

    for (const transaction of expiredTransactions) {
      await this.updateTransaction(transaction.id, {
        status: TransactionStatus.CANCELLED,
      });
    }

    this.logger.log(
      `Cleaned up ${expiredTransactions.length} expired transactions`,
    );
  }
}