import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'redis';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly redisClient: Redis.RedisClientType;

  constructor(private configService: ConfigService) {
    this.redisClient = Redis.createClient({
      url: `redis://${this.configService.get('REDIS_HOST', 'localhost')}:${this.configService.get('REDIS_PORT', 6379)}`,
    });

    this.redisClient.on('error', (err) => {
      this.logger.error('Redis Client Error:', err);
    });

    this.redisClient.connect().catch((err) => {
      this.logger.error('Failed to connect to Redis:', err);
    });
  }

  async storeRefreshToken(userId: string, refreshToken: string, expiresIn: number): Promise<void> {
    try {
      const key = `refresh_token:${userId}`;
      await this.redisClient.setEx(key, expiresIn, refreshToken);
      this.logger.debug(`Stored refresh token for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to store refresh token for user ${userId}:`, error);
      throw error;
    }
  }

  async getRefreshToken(userId: string): Promise<string | null> {
    try {
      const key = `refresh_token:${userId}`;
      const token = await this.redisClient.get(key);
      return token;
    } catch (error) {
      this.logger.error(`Failed to get refresh token for user ${userId}:`, error);
      return null;
    }
  }

  async invalidateRefreshToken(userId: string): Promise<void> {
    try {
      const key = `refresh_token:${userId}`;
      await this.redisClient.del(key);
      this.logger.debug(`Invalidated refresh token for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate refresh token for user ${userId}:`, error);
      throw error;
    }
  }

  async blacklistToken(token: string, expiresIn: number): Promise<void> {
    try {
      const key = `blacklist:${token}`;
      await this.redisClient.setEx(key, expiresIn, '1');
      this.logger.debug('Token blacklisted');
    } catch (error) {
      this.logger.error('Failed to blacklist token:', error);
      throw error;
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const key = `blacklist:${token}`;
      const exists = await this.redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error('Failed to check if token is blacklisted:', error);
      return false;
    }
  }

  async storeUserSession(userId: string, sessionData: any, expiresIn: number): Promise<void> {
    try {
      const key = `session:${userId}`;
      await this.redisClient.setEx(key, expiresIn, JSON.stringify(sessionData));
      this.logger.debug(`Stored session for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to store session for user ${userId}:`, error);
      throw error;
    }
  }

  async getUserSession(userId: string): Promise<any | null> {
    try {
      const key = `session:${userId}`;
      const session = await this.redisClient.get(key);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      this.logger.error(`Failed to get session for user ${userId}:`, error);
      return null;
    }
  }

  async invalidateUserSession(userId: string): Promise<void> {
    try {
      const key = `session:${userId}`;
      await this.redisClient.del(key);
      this.logger.debug(`Invalidated session for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate session for user ${userId}:`, error);
      throw error;
    }
  }

  async storeLoginAttempt(userId: string, attemptData: any, expiresIn: number): Promise<void> {
    try {
      const key = `login_attempt:${userId}`;
      await this.redisClient.setEx(key, expiresIn, JSON.stringify(attemptData));
      this.logger.debug(`Stored login attempt for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to store login attempt for user ${userId}:`, error);
      throw error;
    }
  }

  async getLoginAttempts(userId: string): Promise<any[]> {
    try {
      const pattern = `login_attempt:${userId}:*`;
      const keys = await this.redisClient.keys(pattern);
      const attempts = [];
      
      for (const key of keys) {
        const attempt = await this.redisClient.get(key);
        if (attempt) {
          attempts.push(JSON.parse(attempt));
        }
      }
      
      return attempts;
    } catch (error) {
      this.logger.error(`Failed to get login attempts for user ${userId}:`, error);
      return [];
    }
  }

  async clearLoginAttempts(userId: string): Promise<void> {
    try {
      const pattern = `login_attempt:${userId}:*`;
      const keys = await this.redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await this.redisClient.del(keys);
        this.logger.debug(`Cleared login attempts for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to clear login attempts for user ${userId}:`, error);
      throw error;
    }
  }

  async storeVerificationToken(token: string, userId: string, expiresIn: number): Promise<void> {
    try {
      const key = `verification:${token}`;
      await this.redisClient.setEx(key, expiresIn, userId);
      this.logger.debug(`Stored verification token for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to store verification token for user ${userId}:`, error);
      throw error;
    }
  }

  async getVerificationToken(token: string): Promise<string | null> {
    try {
      const key = `verification:${token}`;
      const userId = await this.redisClient.get(key);
      return userId;
    } catch (error) {
      this.logger.error('Failed to get verification token:', error);
      return null;
    }
  }

  async invalidateVerificationToken(token: string): Promise<void> {
    try {
      const key = `verification:${token}`;
      await this.redisClient.del(key);
      this.logger.debug('Invalidated verification token');
    } catch (error) {
      this.logger.error('Failed to invalidate verification token:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
  }
} 