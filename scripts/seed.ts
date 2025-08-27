import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Logger } from '@nestjs/common';

async function seed() {
  const logger = new Logger('Seeder');
  
  try {
    const app = await NestFactory.createApplicationContext(AppModule);

    logger.log('🌱 Starting database seeding...');

    const seeder = app.get('DatabaseSeeder') as any;
    if (seeder && typeof seeder.seed === 'function') {
      await seeder.seed();
    } else {
      logger.warn('No DatabaseSeeder found — skipping seeds');
    }

    logger.log('✅ Database seeding completed successfully');

    await app.close();
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

seed();