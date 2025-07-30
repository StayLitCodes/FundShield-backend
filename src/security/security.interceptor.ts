import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SecurityService } from './security.service';

@Injectable()
export class SecurityInterceptor implements NestInterceptor {
  constructor(private readonly securityService: SecurityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const res = context.switchToHttp().getResponse();
    return next.handle().pipe(
      tap(() => {
        const requiredHeaders = [
          'x-content-type-options',
          'x-frame-options',
          'x-xss-protection',
          'strict-transport-security',
        ];
        for (const header of requiredHeaders) {
          if (!res.getHeader(header)) {
            this.securityService.logSecurityEvent('MissingSecurityHeader', { header });
          }
        }
      })
    );
  }
} 