// import { ConfigurationService } from '../configuration.service';
// import { ConfigService } from '@nestjs/config';

// describe('ConfigurationService', () => {
//   let configService: ConfigService;
//   let service: ConfigurationService;

//   beforeEach(() => {
//     configService = { get: jest.fn((key) => key + '_VALUE') } as any;
//     service = new ConfigurationService(configService);
//   });
// // 
//   it('should get and cache config values', () => {
//     expect(service.get('FOO')).toBe('FOO_VALUE');
//     expect(service.get('FOO')).toBe('FOO_VALUE'); // from cache
//   });

//   it('should update config and cache', async () => {
//     await service.update('BAR', 'baz');
//     expect(service.get('BAR')).toBe('baz');
//   });
// });
