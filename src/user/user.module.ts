import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProfile } from './entities/user-profile.entity';
import { UserKyc } from './entities/user-kyc.entity';
import { UserPreference } from './entities/user-preference.entity';
import { UserActivity } from './entities/user-activity.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { FileUploadService } from './services/file-upload.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProfile, UserKyc, UserPreference, UserActivity]),
  ],
  providers: [UserService, FileUploadService],
  controllers: [UserController],
  exports: [UserService, FileUploadService],
})
export class UserModule {} 