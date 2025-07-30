import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from '../services/crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-value'),
          },
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSecureRandom', () => {
    it('should generate random bytes of specified length', () => {
      const length = 32;
      const result = service.generateSecureRandom(length);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(length);
    });

    it('should generate different values on subsequent calls', () => {
      const result1 = service.generateSecureRandom(16);
      const result2 = service.generateSecureRandom(16);
      
      expect(result1).not.toEqual(result2);
    });
  });

  describe('generateSecureRandomString', () => {
    it('should generate hex string by default', () => {
      const result = service.generateSecureRandomString({ length: 16 });
      
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[0-9a-f]+$/i);
      expect(result.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it('should generate base64 string when specified', () => {
      const result = service.generateSecureRandomString({
        length: 16,
        encoding: 'base64',
      });
      
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
  });

  describe('constantTimeCompare', () => {
    it('should return true for identical strings', () => {
      const str = 'test-string';
      const result = service.constantTimeCompare(str, str);
      
      expect(result).toBe(true);
    });

    it('should return false for different strings', () => {
      const result = service.constantTimeCompare('string1', 'string2');
      
      expect(result).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      const result = service.constantTimeCompare('short', 'much longer string');
      
      expect(result).toBe(false);
    });
  });

  describe('generateUUID', () => {
    it('should generate valid UUID v4', () => {
      const result = service.generateUUID();
      
      expect(typeof result).toBe('string');
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = service.generateUUID();
      const uuid2 = service.generateUUID();
      
      expect(uuid1).not.toBe(uuid2);
    });
  });
});