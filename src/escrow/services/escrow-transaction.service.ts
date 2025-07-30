import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import type { EscrowTransaction } from "../entities/escrow-transaction.entity"
import type { CreateTransactionDto } from "../dto/escrow-transaction.dto"
import { TransactionStatus } from "../enums/transaction-status.enum"
import { TransactionType } from "../enums/transaction-type.enum"
import type { SmartContractService } from "./smart-contract.service"
import type { EscrowAuditService } from "./escrow-audit.service"
import { AuditAction } from "../enums/audit-action.enum"

@Injectable()
export class EscrowTransactionService {
  private readonly logger = new Logger(EscrowTransactionService.name)

  constructor(
    private transactionRepository: Repository<EscrowTransaction>,
    private smartContractQueue: Queue,
    private smartContractService: SmartContractService,
    private escrowAuditService: EscrowAuditService,
  ) {}

  async createTransaction(createTransactionDto: CreateTransactionDto): Promise<EscrowTransaction> {
    const transaction = this.transactionRepository.create(createTransactionDto)
    const savedTransaction = await this.transactionRepository.save(transaction)

    // Queue for blockchain processing if needed
    if (this.requiresBlockchainProcessing(createTransactionDto.type)) {
      await this.smartContractQueue.add("process-transaction", {
        transactionId: savedTransaction.id,
      })
    }

    // Log audit trail
    await this.escrowAuditService.logAction(
      createTransactionDto.escrowId,
      AuditAction.CREATED,
      createTransactionDto.initiatedBy,
      {
        description: `Transaction created: ${createTransactionDto.type}`,
        newValues: savedTransaction,
      },
    )

    this.logger.log(`Transaction created: ${savedTransaction.id} - ${savedTransaction.type}`)
    return savedTransaction
  }

  async updateTransactionStatus(
    id: string,
    status: TransactionStatus,
    metadata?: Record<string, any>,
  ): Promise<EscrowTransaction> {
    const transaction = await this.getTransactionById(id)
    const oldStatus = transaction.status

    transaction.status = status
    transaction.metadata = { ...transaction.metadata, ...metadata }

    if (status === TransactionStatus.COMPLETED) {
      transaction.processedAt = new Date()
    } else if (status === TransactionStatus.CONFIRMED) {
      transaction.confirmedAt = new Date()
    }

    const updatedTransaction = await this.transactionRepository.save(transaction)

    // Log audit trail
    await this.escrowAuditService.logAction(transaction.escrowId, AuditAction.UPDATED, "system", {
      description: `Transaction status updated: ${oldStatus} -> ${status}`,
      oldValues: { status: oldStatus },
      newValues: { status },
    })

    this.logger.log(`Transaction ${id} status updated: ${oldStatus} -> ${status}`)
    return updatedTransaction
  }

  async getTransactionById(id: string): Promise<EscrowTransaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: ["escrow", "milestone"],
    })

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`)
    }

    return transaction
  }

  async getEscrowTransactions(escrowId: string): Promise<EscrowTransaction[]> {
    return this.transactionRepository.find({
      where: { escrowId },
      order: { createdAt: "DESC" },
      relations: ["milestone"],
    })
  }

  async getMilestoneTransactions(milestoneId: string): Promise<EscrowTransaction[]> {
    return this.transactionRepository.find({
      where: { milestoneId },
      order: { createdAt: "DESC" },
    })
  }

  async processTransaction(id: string): Promise<EscrowTransaction> {
    const transaction = await this.getTransactionById(id)

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException(`Cannot process transaction in ${transaction.status} status`)
    }

    try {
      await this.updateTransactionStatus(id, TransactionStatus.PROCESSING)

      // Process based on transaction type
      switch (transaction.type) {
        case TransactionType.DEPOSIT:
          await this.processDeposit(transaction)
          break
        case TransactionType.RELEASE:
          await this.processRelease(transaction)
          break
        case TransactionType.REFUND:
          await this.processRefund(transaction)
          break
        case TransactionType.PARTIAL_RELEASE:
          await this.processPartialRelease(transaction)
          break
        default:
          throw new Error(`Unsupported transaction type: ${transaction.type}`)
      }

      await this.updateTransactionStatus(id, TransactionStatus.COMPLETED)
      this.logger.log(`Transaction processed successfully: ${id}`)

      return await this.getTransactionById(id)
    } catch (error) {
      await this.updateTransactionStatus(id, TransactionStatus.FAILED, {
        error: error.message,
        failedAt: new Date(),
      })

      this.logger.error(`Transaction processing failed: ${id}`, error)
      throw error
    }
  }

  async getTransactionHistory(escrowId: string): Promise<EscrowTransaction[]> {
    return this.transactionRepository.find({
      where: { escrowId },
      order: { createdAt: "ASC" },
      relations: ["milestone"],
    })
  }

  async getTransactionSummary(escrowId: string): Promise<{
    totalDeposited: number
    totalReleased: number
    totalRefunded: number
    totalFees: number
    pendingAmount: number
  }> {
    const transactions = await this.getEscrowTransactions(escrowId)

    const summary = transactions.reduce(
      (acc, transaction) => {
        if (transaction.status === TransactionStatus.COMPLETED) {
          switch (transaction.type) {
            case TransactionType.DEPOSIT:
              acc.totalDeposited += transaction.amount
              break
            case TransactionType.RELEASE:
            case TransactionType.PARTIAL_RELEASE:
              acc.totalReleased += transaction.amount
              break
            case TransactionType.REFUND:
              acc.totalRefunded += transaction.amount
              break
            case TransactionType.FEE_COLLECTION:
              acc.totalFees += transaction.amount
              break
          }
        } else if (transaction.status === TransactionStatus.PENDING) {
          acc.pendingAmount += transaction.amount
        }
        return acc
      },
      {
        totalDeposited: 0,
        totalReleased: 0,
        totalRefunded: 0,
        totalFees: 0,
        pendingAmount: 0,
      },
    )

    return summary
  }

  private async processDeposit(transaction: EscrowTransaction): Promise<void> {
    // Implement deposit processing logic
    // This could involve calling external payment processors or smart contracts
    if (transaction.escrow.smartContractAddress) {
      await this.smartContractService.deposit(
        transaction.escrow.smartContractAddress,
        transaction.amount,
        transaction.currency,
      )
    }

    this.logger.log(`Deposit processed: ${transaction.amount} ${transaction.currency}`)
  }

  private async processRelease(transaction: EscrowTransaction): Promise<void> {
    // Implement release processing logic
    if (transaction.escrow.smartContractAddress) {
      await this.smartContractService.release(
        transaction.escrow.smartContractAddress,
        transaction.amount,
        transaction.escrow.sellerId,
      )
    }

    this.logger.log(`Release processed: ${transaction.amount} ${transaction.currency}`)
  }

  private async processRefund(transaction: EscrowTransaction): Promise<void> {
    // Implement refund processing logic
    if (transaction.escrow.smartContractAddress) {
      await this.smartContractService.refund(
        transaction.escrow.smartContractAddress,
        transaction.amount,
        transaction.escrow.buyerId,
      )
    }

    this.logger.log(`Refund processed: ${transaction.amount} ${transaction.currency}`)
  }

  private async processPartialRelease(transaction: EscrowTransaction): Promise<void> {
    // Implement partial release processing logic
    if (transaction.escrow.smartContractAddress) {
      await this.smartContractService.partialRelease(
        transaction.escrow.smartContractAddress,
        transaction.amount,
        transaction.escrow.sellerId,
      )
    }

    this.logger.log(`Partial release processed: ${transaction.amount} ${transaction.currency}`)
  }

  private requiresBlockchainProcessing(type: TransactionType): boolean {
    const blockchainTypes = [
      TransactionType.DEPOSIT,
      TransactionType.RELEASE,
      TransactionType.REFUND,
      TransactionType.PARTIAL_RELEASE,
    ]
    return blockchainTypes.includes(type)
  }
}
