// import { AuditTrailService } from '../audit-trail.service';

// describe('AuditTrailService', () => {
//   let service: AuditTrailService;
//   let logSpy: jest.SpyInstance;

//   beforeEach(() => {
//     service = new AuditTrailService();
//     logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
//   });

//   afterEach(() => {
//     logSpy.mockRestore();
//   });

//   it('should log configuration changes', async () => {
//     await service.logChange('TEST_KEY', 'TEST_VALUE');
//     expect(logSpy).toHaveBeenCalledWith('Configuration changed: TEST_KEY = TEST_VALUE');
//   });
// });
