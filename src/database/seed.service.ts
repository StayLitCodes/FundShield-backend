import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Escrow } from '../escrow/entities/escrow.entity';
import { Transaction } from '../models/transaction.entity';

@Injectable()
export class DatabaseSeeder {
  private readonly logger = new Logger('DatabaseSeeder');

  constructor(private dataSource: DataSource) {}

  async seed() {
    this.logger.log('Running development seeds...');

    const userRepo = this.dataSource.getRepository(User);
    const escrowRepo = this.dataSource.getRepository(Escrow);
    const txRepo = this.dataSource.getRepository(Transaction as any);

    // Simple guard to avoid re-seeding
    const count = await userRepo.count();
    if (count > 0) {
      this.logger.log('Seed skipped — users already exist');
      return;
    }

    const alice = userRepo.create({
      username: 'alice',
      email: 'alice@example.com',
      password: 'password123',
      role: 'user',
      status: 'active',
    } as any);

    const bob = userRepo.create({
      username: 'bob',
      email: 'bob@example.com',
      password: 'password123',
      role: 'user',
      status: 'active',
    } as any);

    await userRepo.save([alice, bob]);

    const escrow = escrowRepo.create({
      escrowNumber: `ESC-${Date.now()}`,
      title: 'Test escrow',
      type: 'standard',
      status: 'created',
      buyerId: alice.id,
      sellerId: bob.id,
      totalAmount: 100.0,
      currency: 'USD',
    } as any);

    await escrowRepo.save(escrow);

    const tx = txRepo.create({
      sagaId: null,
      userId: alice.id,
      transactionType: 'transfer',
      status: 'pending',
      transactionHash: null,
      amount: '100.0',
      idempotencyKey: `seed-${Date.now()}`,
    } as any);

    await txRepo.save(tx);

    this.logger.log('Seeding complete');
  }
}
