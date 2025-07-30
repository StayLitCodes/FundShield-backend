import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';

function sanitizeString(str: string): string {
  // XSS protection
  let sanitized = DOMPurify.sanitize(str);
  // Simple SQLi pattern removal
  sanitized = sanitized.replace(/([';--])/g, '');
  return sanitized;
}

function deepSanitize(obj: any): any {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(deepSanitize);
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key of Object.keys(obj)) {
      sanitized[key] = deepSanitize(obj[key]);
    }
    return sanitized;
  }
  return obj;
}

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    return deepSanitize(value);
  }
} 