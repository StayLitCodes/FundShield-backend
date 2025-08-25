import { FeatureFlagService } from '../feature-flag.service';
import { ConfigurationService } from '../configuration.service';

describe('FeatureFlagService', () => {
  let configService: ConfigurationService;
  let service: FeatureFlagService;

  beforeEach(() => {
    configService = { get: jest.fn(() => 'A,B,C') } as any;
    service = new FeatureFlagService(configService);
  });

  it('should return true if flag is enabled', () => {
    expect(service.isEnabled('A')).toBe(true);
    expect(service.isEnabled('B')).toBe(true);
    expect(service.isEnabled('C')).toBe(true);
  });

  it('should return false if flag is not enabled', () => {
    expect(service.isEnabled('D')).toBe(false);
  });
});
