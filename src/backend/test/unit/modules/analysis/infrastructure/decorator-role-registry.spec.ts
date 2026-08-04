import { DecoratorRoleRegistry } from '@/modules/analysis/infrastructure/parsers/decorator-role-registry';

describe('DecoratorRoleRegistry', () => {
  const registry = new DecoratorRoleRegistry();

  describe('default mappings', () => {
    it('should map Controller to controller', () => {
      expect(registry.get('Controller')).toBe('controller');
    });

    it('should map Injectable to service', () => {
      expect(registry.get('Injectable')).toBe('service');
    });

    it('should map Module to module', () => {
      expect(registry.get('Module')).toBe('module');
    });

    it('should map EntityRepository to repository', () => {
      expect(registry.get('EntityRepository')).toBe('repository');
    });

    it('should return null for an unknown decorator name', () => {
      expect(registry.get('CustomDecorator')).toBeNull();
    });
  });

  describe('register', () => {
    it('should allow extending with a custom decorator mapping', () => {
      registry.register('MyController', 'controller');

      expect(registry.get('MyController')).toBe('controller');
    });

    it('should allow overriding a default mapping', () => {
      registry.register('Controller', 'custom-role');

      expect(registry.get('Controller')).toBe('custom-role');
    });
  });

  describe('getRole', () => {
    it('should expose getRole as alias for get', () => {
      expect(registry.getRole('Controller')).toBe(registry.get('Controller'));
    });
  });
});
