import { Test, TestingModule } from '@nestjs/testing';
import { TokenEncryptionService } from './token-encryption.service';
import { ConfigService } from '../../../../config/config.service';

describe('TokenEncryptionService', () => {
  let service: TokenEncryptionService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      oauth: {
        github: { clientId: '', clientSecret: '', callbackUrl: '' },
        tokenEncryptionKey: 'test-encryption-key-1234567890abcdef',
      },
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenEncryptionService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<TokenEncryptionService>(TokenEncryptionService);
  });

  describe('encrypt', () => {
    it('should return a base64-encoded string', () => {
      const result = service.encrypt('hello-world');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Base64 pattern
      expect(result).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should produce different ciphertext for the same plaintext (random IV)', () => {
      const plaintext = 'same-value';

      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('decrypt', () => {
    it('should round-trip a plaintext value correctly', () => {
      const plaintext = 'gho_abc123secret_token';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should round-trip long tokens', () => {
      const plaintext = 'x'.repeat(500);

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should round-trip empty string', () => {
      const plaintext = '';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('tamper detection', () => {
    it('should throw when ciphertext is tampered with', () => {
      const encrypted = service.encrypt('my-token');

      // Tamper with the base64 string
      const tampered = encrypted.replace(/^./, encrypted[0] === 'a' ? 'b' : 'a');

      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw on invalid base64 input', () => {
      expect(() => service.decrypt('!!!not-base64!!!')).toThrow();
    });
  });
});
