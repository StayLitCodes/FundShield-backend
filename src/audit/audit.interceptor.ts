import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = req.user ? req.user.username || req.user.id : 'anonymous';
    const action = req.method;
    const resource = req.route ? req.route.path : req.url;
    const oldValue = null; // Optionally fetch previous state if needed
    const newValue = req.body;
    const metadata = {
      ip: req.ip,
      headers: req.headers,
      query: req.query,
      params: req.params,
    };

    return next.handle().pipe(
      tap(async (response) => {
        await this.auditService.createLog({
          user,
          action,
          resource,
          oldValue,
          newValue: response || newValue,
          metadata,
        });
      }),
      catchError(async (err) => {
        await this.auditService.createLog({
          user,
          action,
          resource,
          oldValue,
          newValue,
          metadata: { ...metadata, error: err.message },
        });
        throw err;
      })
    );
  }
} 