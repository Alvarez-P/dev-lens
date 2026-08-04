import { Language } from '@/modules/analysis/domain/language.vo';

describe('Language', () => {
  describe('create', () => {
    it('should create a Language with name and extension', () => {
      const language = Language.create('typescript', '.ts');

      expect(language.name).toBe('typescript');
      expect(language.extension).toBe('.ts');
    });

    it('should reject an empty name', () => {
      expect(() => Language.create('', '.ts')).toThrow('Language name must not be empty');
    });

    it('should reject an extension without a leading dot', () => {
      expect(() => Language.create('typescript', 'ts')).toThrow('Extension must start with a dot');
    });
  });

  describe('equality', () => {
    it('should be equal for same name and extension', () => {
      const a = Language.create('typescript', '.ts');
      const b = Language.create('typescript', '.ts');

      expect(a.equals(b)).toBe(true);
    });

    it('should not be equal for different extensions', () => {
      const a = Language.create('typescript', '.ts');
      const b = Language.create('typescript', '.tsx');

      expect(a.equals(b)).toBe(false);
    });

    it('should not be equal for different names', () => {
      const a = Language.create('typescript', '.ts');
      const b = Language.create('javascript', '.ts');

      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the language name', () => {
      const language = Language.create('typescript', '.ts');

      expect(language.toString()).toBe('typescript');
    });
  });
});
