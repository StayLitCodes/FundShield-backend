import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class SecurityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Placeholder: add security checks
    return true;
  }
} 