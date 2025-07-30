import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TwoFactorService } from '../services/two-factor.service';
import { User } from '../entities/user.entity';
import * as speakeasy from 'speakeasy';

jest.mock('speakeasy');

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TwoFactorService>(TwoFactorService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSecret', () => {
    it('should generate secret and QR code URL', () => {
      const mockUser = {
        email: 'test@example.com',
      } as User;

      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/FundShield%20(test%40example.com)?secret=JBSWY3DPEHPK3PXP&issuer=FundShield',
        ascii: 'test',
        hex: '74657374',
        google_auth_qr: 'data:image/png;base64,test',
      };

      jest.spyOn(speakeasy, 'generateSecret').mockReturnValue(mockSecret);
      jest.spyOn(speakeasy, 'otpauthURL').mockReturnValue(mockSecret.otpauth_url);

      const result = service.generateSecret(mockUser);

      expect(result.secret).toBe(mockSecret.base32);
      expect(result.qrCodeUrl).toBe(mockSecret.otpauth_url);
      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: 'FundShield (test@example.com)',
        issuer: 'FundShield',
        length: 32,
      });
    });
  });

  describe('verifyToken', () => {
    it('should return true for valid token', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const token = '123456';

      jest.spyOn(speakeasy.totp, 'verify').mockReturnValue(true);

      const result = service.verifyToken(token, secret);

      expect(result).toBe(true);
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret,
        encoding: 'base32',
        token,
        window: 2,
      });
    });

    it('should return false for invalid token', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const token = '123456';

      jest.spyOn(speakeasy.totp, 'verify').mockReturnValue(false);

      const result = service.verifyToken(token, secret);

      expect(result).toBe(false);
    });

    it('should return false when verification throws error', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const token = 'invalid';

      jest.spyOn(speakeasy.totp, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = service.verifyToken(token, secret);

      expect(result).toBe(false);
    });
  });

  describe('verifyBackupCode', () => {
    it('should return true for valid backup code', () => {
      const mockUser = {
        twoFactorBackupCodes: JSON.stringify(['ABC123', 'DEF456', 'GHI789']),
      } as User;

      const result = service.verifyBackupCode('ABC123', mockUser);

      expect(result).toBe(true);
      expect(mockUser.twoFactorBackupCodes).toBe(JSON.stringify(['DEF456', 'GHI789']));
    });

    it('should return false for invalid backup code', () => {
      const mockUser = {
        twoFactorBackupCodes: JSON.stringify(['ABC123', 'DEF456', 'GHI789']),
      } as User;

      const result = service.verifyBackupCode('XYZ999', mockUser);

      expect(result).toBe(false);
      expect(mockUser.twoFactorBackupCodes).toBe(JSON.stringify(['ABC123', 'DEF456', 'GHI789']));
    });

    it('should return false when backup codes are empty', () => {
      const mockUser = {
        twoFactorBackupCodes: JSON.stringify([]),
      } as User;

      const result = service.verifyBackupCode('ABC123', mockUser);

      expect(result).toBe(false);
    });

    it('should return false when backup codes are null', () => {
      const mockUser = {
        twoFactorBackupCodes: null,
      } as User;

      const result = service.verifyBackupCode('ABC123', mockUser);

      expect(result).toBe(false);
    });

    it('should handle case-insensitive backup codes', () => {
      const mockUser = {
        twoFactorBackupCodes: JSON.stringify(['ABC123', 'DEF456', 'GHI789']),
      } as User;

      const result = service.verifyBackupCode('abc123', mockUser);

      expect(result).toBe(true);
      expect(mockUser.twoFactorBackupCodes).toBe(JSON.stringify(['DEF456', 'GHI789']));
    });

    it('should return false when verification throws error', () => {
      const mockUser = {
        twoFactorBackupCodes: 'invalid-json',
      } as User;

      const result = service.verifyBackupCode('ABC123', mockUser);

      expect(result).toBe(false);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes', () => {
      const codes = service.generateBackupCodes();

      expect(codes).toHaveLength(10);
      codes.forEach(code => {
        expect(code).toMatch(/^[A-F0-9]{6}$/);
      });
    });

    it('should generate unique codes', () => {
      const codes1 = service.generateBackupCodes();
      const codes2 = service.generateBackupCodes();

      expect(codes1).not.toEqual(codes2);
    });
  });

  describe('isTokenExpired', () => {
    it('should return false (placeholder implementation)', () => {
      const result = service.isTokenExpired('any-token');

      expect(result).toBe(false);
    });
  });

  describe('getRemainingTime', () => {
    it('should return remaining time in seconds', () => {
      const result = service.getRemainingTime();

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(30);
    });
  });
}); 