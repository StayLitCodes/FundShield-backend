import { SecurityInterceptor } from './security.interceptor';
import { SecurityService } from './security.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('SecurityInterceptor', () => {
  let interceptor: SecurityInterceptor;
  let securityService: SecurityService;
  let context: Partial<ExecutionContext>;
  let callHandler: Partial<CallHandler>;
  let res: any;

  beforeEach(() => {
    securityService = { logSecurityEvent: jest.fn() } as any;
    interceptor = new SecurityInterceptor(securityService);
    res = {
      getHeader: jest.fn((header) => {
        // Simulate all headers present by default
        return 'value';
      }),
    };
    context = {
      switchToHttp: () => ({ getResponse: () => res }),
    } as any;
    callHandler = { handle: () => of('response') };
  });

  it('should not log if all headers are present', (done) => {
    interceptor.intercept(context as ExecutionContext, callHandler as CallHandler).subscribe(() => {
      expect(securityService.logSecurityEvent).not.toHaveBeenCalled();
      done();
    });
  });

  it('should log if a required header is missing', (done) => {
    res.getHeader = jest.fn((header) => (header === 'x-frame-options' ? undefined : 'value'));
    interceptor.intercept(context as ExecutionContext, callHandler as CallHandler).subscribe(() => {
      expect(securityService.logSecurityEvent).toHaveBeenCalledWith('MissingSecurityHeader', { header: 'x-frame-options' });
      done();
    });
  });
}); 