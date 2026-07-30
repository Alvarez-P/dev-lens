import { JwtService } from '@nestjs/jwt';
import { OAuthStateService } from './oauth-state.service';

describe('OAuthStateService', () => {
  let service: OAuthStateService;
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = new JwtService({ secret: 'test-secret-for-jwt' });
    service = new OAuthStateService(jwtService);
  });

  describe('sign', () => {
    it('should return a JWT string', () => {
      const token = service.sign('state-abc-123');

      expect(typeof token).toBe('string');
      // JWT has three parts separated by dots
      expect(token.split('.')).toHaveLength(3);
    });

    it('should produce different tokens for different states', () => {
      const token1 = service.sign('state-1');
      const token2 = service.sign('state-2');

      expect(token1).not.toBe(token2);
    });
  });

  describe('verify', () => {
    it('should return the original state from a valid token', () => {
      const originalState = 'csrf-random-state-value';

      const token = service.sign(originalState);
      const result = service.verify(token);

      expect(result).toBe(originalState);
    });

    it('should throw on an expired token', () => {
      // Sign with a past expiry
      const token = jwtService.sign({ state: 'test-state' }, { expiresIn: -1 });

      expect(() => service.verify(token)).toThrow();
    });

    it('should throw on a tampered token', () => {
      const token = service.sign('my-state');
      const parts = token.split('.');

      // Tamper the payload
      const tampered = [parts[0], 'eyJ0YW1wZXJlZCI6InRydWUifQ', parts[2]].join('.');

      expect(() => service.verify(tampered)).toThrow();
    });

    it('should throw on an invalid JWT string', () => {
      expect(() => service.verify('not-a-jwt')).toThrow();
    });
  });
});
