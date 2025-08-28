import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from '../config/database.config';
import { DatabaseSeeder } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),
  ],
  providers: [DatabaseSeeder],
  exports: [],
})
export class DatabaseModule {}
