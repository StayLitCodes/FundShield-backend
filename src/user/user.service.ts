import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UserKyc, KycStatus } from './entities/user-kyc.entity';
import { UserPreference } from './entities/user-preference.entity';
import { UserActivity } from './entities/user-activity.entity';
import {
  RegisterUserDto,
  UpdateProfileDto,
  SubmitKycDto,
  UpdatePreferenceDto,
  UserSearchFilterDto,
} from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserProfile) private profileRepo: Repository<UserProfile>,
    @InjectRepository(UserKyc) private kycRepo: Repository<UserKyc>,
    @InjectRepository(UserPreference) private prefRepo: Repository<UserPreference>,
    @InjectRepository(UserActivity) private activityRepo: Repository<UserActivity>,
  ) {}

  async register(dto: RegisterUserDto): Promise<User> {
    // Registration logic (simplified, add password hashing, etc.)
    const user = this.userRepo.create({
      username: dto.username,
      email: dto.email,
      password: dto.password,
    });
    await this.userRepo.save(user);
    const profile = this.profileRepo.create({ user, firstName: dto.firstName, lastName: dto.lastName });
    await this.profileRepo.save(profile);
    return user;
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const profile = await this.profileRepo.findOne({ where: { user: { id: userId } }, relations: ['user'] });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const profile = await this.profileRepo.findOne({ where: { user: { id: userId } }, relations: ['user'] });
    if (!profile) throw new NotFoundException('Profile not found');
    Object.assign(profile, dto);
    await this.profileRepo.save(profile);
    return profile;
  }

  async submitKyc(userId: string, dto: SubmitKycDto): Promise<UserKyc> {
    let kyc = await this.kycRepo.findOne({ where: { user: { id: userId } }, relations: ['user'] });
    if (!kyc) {
      kyc = this.kycRepo.create({ user: { id: userId } as User, ...dto });
    } else {
      Object.assign(kyc, dto);
    }
    await this.kycRepo.save(kyc);
    return kyc;
  }

  async updatePreference(userId: string, dto: UpdatePreferenceDto): Promise<UserPreference> {
    let pref = await this.prefRepo.findOne({ where: { user: { id: userId } }, relations: ['user'] });
    if (!pref) {
      pref = this.prefRepo.create({ user: { id: userId } as User, ...dto });
    } else {
      Object.assign(pref, dto);
    }
    await this.prefRepo.save(pref);
    return pref;
  }

  async logActivity(userId: string, action: string, metadata?: Record<string, any>): Promise<UserActivity> {
    const activity = this.activityRepo.create({ user: { id: userId } as User, action, metadata });
    await this.activityRepo.save(activity);
    return activity;
  }

  async searchUsers(filter: UserSearchFilterDto): Promise<User[]> {
    const qb = this.userRepo.createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('user.kyc', 'kyc')
      .leftJoinAndSelect('user.preference', 'preference');
    if (filter.query) {
      qb.andWhere('user.username ILIKE :query OR user.email ILIKE :query', { query: `%${filter.query}%` });
    }
    if (filter.kycStatus) {
      qb.andWhere('kyc.status = :kycStatus', { kycStatus: filter.kycStatus });
    }
    if (filter.isSuspended !== undefined) {
      qb.andWhere('user.isSuspended = :isSuspended', { isSuspended: filter.isSuspended });
    }
    if (filter.isDeleted !== undefined) {
      qb.andWhere('user.isDeleted = :isDeleted', { isDeleted: filter.isDeleted });
    }
    return qb.getMany();
  }

  async suspendUser(userId: string, reason: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isSuspended = true;
    user.suspendedAt = new Date();
    user.suspensionReason = reason;
    await this.userRepo.save(user);
    return user;
  }

  async recoverUser(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isSuspended = false;
    user.suspendedAt = null;
    user.suspensionReason = null;
    await this.userRepo.save(user);
    return user;
  }

  async addKycDocument(userId: string, doc: { type: string; url: string }): Promise<void> {
    let kyc = await this.kycRepo.findOne({ where: { user: { id: userId } }, relations: ['user'] });
    if (!kyc) {
      kyc = this.kycRepo.create({ user: { id: userId } as User, status: KycStatus.PENDING, documents: [doc] });
    } else {
      kyc.documents = kyc.documents ? [...kyc.documents, doc] : [doc];
    }
    await this.kycRepo.save(kyc);
  }
} 