import { ApiKeyGuard } from './api-key.guard';
import { SecurityService } from './security.service';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let securityService: SecurityService;
  let context: Partial<ExecutionContext>;

  beforeEach(() => {
    securityService = { validateApiKey: jest.fn() } as any;
    guard = new ApiKeyGuard(securityService);
    context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-api-key': 'valid' } }) }),
    } as any;
  });

  it('should allow request with valid API key', () => {
    (securityService.validateApiKey as jest.Mock).mockReturnValue(true);
    expect(guard.canActivate(context as ExecutionContext)).toBe(true);
  });

  it('should throw if API key is missing', () => {
    context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as any;
    expect(() => guard.canActivate(context as ExecutionContext)).toThrow(UnauthorizedException);
  });

  it('should throw if API key is invalid', () => {
    (securityService.validateApiKey as jest.Mock).mockReturnValue(false);
    expect(() => guard.canActivate(context as ExecutionContext)).toThrow(UnauthorizedException);
  });
}); 