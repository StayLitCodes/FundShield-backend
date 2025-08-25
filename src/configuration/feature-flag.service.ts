import { Injectable } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';

@Injectable()
export class FeatureFlagService {
  constructor(private readonly configService: ConfigurationService) {}

  isEnabled(flag: string): boolean {
    const flags = this.configService.get<string>('FEATURE_FLAGS');
    if (!flags) return false;
    return flags.split(',').map(f => f.trim()).includes(flag);
  }
}
