import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SecurityService } from './security.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly securityService: SecurityService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || !this.securityService.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }
    return true;
  }
} 