import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ConfigurationService {
  private cache = new Map<string, any>();

  constructor(private readonly configService: ConfigService) {}

  get<T = any>(key: string): T {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    const value = this.configService.get<T>(key);
    this.cache.set(key, value);
    return value;
  }

  async update(key: string, value: any) {
    // For demonstration, update cache and process.env
    this.cache.set(key, value);
    if (typeof process !== 'undefined' && process.env) {
      process.env[key] = value;
    }
    return { key, value };
  }
}

export function configuration() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    PORT: parseInt(process.env.PORT || '3000', 10),
    FEATURE_FLAGS: process.env.FEATURE_FLAGS || '',
    // Add more config values as needed
  };
}
