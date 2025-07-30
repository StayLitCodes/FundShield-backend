import { RateLimitGuard } from './rate-limit.guard';
import { ExecutionContext, TooManyRequestsException } from '@nestjs/common';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    incr: jest.fn(),
    expire: jest.fn(),
  }));
});

const mockContext = (user = 'user1', endpoint = '/test', ip = '127.0.0.1') => ({
  switchToHttp: () => ({
    getRequest: () => ({ user: { id: user }, route: { path: endpoint }, ip }),
  }),
});

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let redis: any;
  const originalDateNow = Date.now;

  beforeEach(() => {
    guard = new RateLimitGuard();
    redis = require('ioredis').mock.instances[0];
    jest.clearAllMocks();
    Date.now = jest.fn(() => 1000000000000);
  });

  afterAll(() => {
    Date.now = originalDateNow;
  });

  it('should allow requests under the limit', async () => {
    redis.incr.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);
    await expect(guard.canActivate(mockContext() as any)).resolves.toBe(true);
  });

  it('should block requests over the limit', async () => {
    redis.incr.mockResolvedValue(101);
    await expect(guard.canActivate(mockContext() as any)).rejects.toThrow(TooManyRequestsException);
  });

  it('should use in-memory fallback if Redis fails', async () => {
    redis.incr.mockRejectedValue(new Error('Redis down'));
    // Simulate first request (should pass)
    await expect(guard.canActivate(mockContext() as any)).resolves.toBe(true);
    // Simulate 101st request (should block)
    for (let i = 0; i < 100; i++) {
      await guard.canActivate(mockContext() as any);
    }
    await expect(guard.canActivate(mockContext() as any)).rejects.toThrow(TooManyRequestsException);
  });
}); 