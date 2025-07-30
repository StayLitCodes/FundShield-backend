import { Injectable, CanActivate, ExecutionContext, TooManyRequestsException } from '@nestjs/common';
import * as Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
});

const WINDOW_SIZE = 60; // seconds
const MAX_REQUESTS = 100;
const inMemoryStore = new Map<string, { count: number; expires: number }>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user ? req.user.id : req.ip;
    const endpoint = req.route ? req.route.path : req.url;
    const key = `rate:${user}:${endpoint}`;
    const now = Math.floor(Date.now() / 1000);

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, WINDOW_SIZE);
      }
      if (count > MAX_REQUESTS) {
        throw new TooManyRequestsException('Rate limit exceeded');
      }
      return true;
    } catch (err) {
      // Fallback to in-memory store if Redis fails
      let entry = inMemoryStore.get(key);
      if (!entry || entry.expires < now) {
        entry = { count: 1, expires: now + WINDOW_SIZE };
      } else {
        entry.count++;
      }
      inMemoryStore.set(key, entry);
      if (entry.count > MAX_REQUESTS) {
        throw new TooManyRequestsException('Rate limit exceeded (memory fallback)');
      }
      return true;
    }
  }
} 