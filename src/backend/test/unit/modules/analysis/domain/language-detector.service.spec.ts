import { Language } from '@/modules/analysis/domain/language.vo';
import { LanguageDetector } from '@/modules/analysis/domain/services/language-detector.service';

function groupFor(groups: Map<Language, string[]>, name: string): string[] | undefined {
  for (const [language, files] of groups) {
    if (language.name === name) {
      return files;
    }
  }
  return undefined;
}

describe('LanguageDetector', () => {
  const detector = new LanguageDetector();

  describe('detect', () => {
    it('should map .ts to typescript', () => {
      const result = detector.detect('src/controller.ts');

      expect(result).not.toBeNull();
      expect(result?.toString()).toBe('typescript');
      expect(result?.extension).toBe('.ts');
    });

    it('should map .tsx to typescript', () => {
      const result = detector.detect('src/Component.tsx');

      expect(result?.toString()).toBe('typescript');
    });

    it('should map .js to javascript', () => {
      const result = detector.detect('lib/utils.js');

      expect(result?.toString()).toBe('javascript');
    });

    it('should map .jsx to javascript', () => {
      const result = detector.detect('lib/View.jsx');

      expect(result?.toString()).toBe('javascript');
    });

    it('should return null for unknown extensions instead of throwing', () => {
      expect(() => detector.detect('assets/logo.png')).not.toThrow();
      expect(detector.detect('assets/logo.png')).toBeNull();
      expect(detector.detect('data/schema.sql')).toBeNull();
    });

    it('should be case-insensitive for extensions', () => {
      const result = detector.detect('src/Component.TSX');

      expect(result?.toString()).toBe('typescript');
    });

    it('should be deterministic across invocations', () => {
      const first = detector.detect('src/controller.ts');
      const second = detector.detect('src/controller.ts');

      expect(first?.equals(second as never)).toBe(true);
    });
  });

  describe('detectMany', () => {
    it('should group files by language', () => {
      const files = ['a.ts', 'b.js', 'c.tsx', 'logo.png'];

      const groups = detector.detectMany(files);

      expect(groupFor(groups, 'typescript')).toEqual(['a.ts', 'c.tsx']);
      expect(groupFor(groups, 'javascript')).toEqual(['b.js']);
      expect(groups.size).toBe(2);
    });

    it('should skip unknown extensions gracefully', () => {
      const groups = detector.detectMany(['logo.png', 'schema.sql']);

      expect(groups.size).toBe(0);
    });

    it('should return the same grouping for identical input', () => {
      const files = ['a.ts', 'b.js'];

      const first = detector.detectMany(files);
      const second = detector.detectMany(files);

      expect(groupFor(first, 'typescript')).toEqual(groupFor(second, 'typescript'));
      expect(groupFor(first, 'javascript')).toEqual(groupFor(second, 'javascript'));
    });
  });
});
