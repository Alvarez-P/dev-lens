import { Logger } from '@nestjs/common';
import { SourceFileFilter } from '@/modules/ai/application/source-file-filter';

/**
 * Task 4.3 (REQ-CA-004): allow/deny-list enforcement before sketch
 * construction. `.ts/.tsx/.js/.jsx` allowed; `.env*` and ignored directories
 * denied with a warn log; non-source files silently skipped.
 */
describe('SourceFileFilter (REQ-CA-004)', () => {
  const filter = new SourceFileFilter();

  describe('allow-list', () => {
    it('should allow .ts and .tsx files', () => {
      expect(filter.classify('src/users/users.controller.ts').include).toBe(true);
      expect(filter.classify('src/app/app.tsx').include).toBe(true);
    });

    it('should allow .js and .jsx files', () => {
      expect(filter.classify('src/index.js').include).toBe(true);
      expect(filter.classify('src/components/button.jsx').include).toBe(true);
    });
  });

  describe('.env* deny-list', () => {
    it('should deny .env files unconditionally with the .env* rule', () => {
      const result = filter.classify('.env');

      expect(result.include).toBe(false);
      expect(result.rule).toBe('.env*');
    });

    it('should deny .env.local, .env.production, and other .env variants', () => {
      for (const path of [
        '.env.local',
        '.env.production',
        '.env.test',
        'config/.env.development',
      ]) {
        const result = filter.classify(path);

        expect(result.include).toBe(false);
        expect(result.rule).toBe('.env*');
      }
    });
  });

  describe('ignored directories', () => {
    it('should deny files under node_modules, dist, and .git', () => {
      expect(filter.classify('node_modules/foo/index.ts').include).toBe(false);
      expect(filter.classify('dist/main.js').include).toBe(false);
      expect(filter.classify('.git/config').include).toBe(false);
    });

    it('should report the ignored-directory rule for denied dirs', () => {
      const result = filter.classify('node_modules/foo/index.ts');

      expect(result.rule).toBe('ignored-directory');
    });
  });

  describe('non-source files', () => {
    it('should silently skip non-source extensions (no rule)', () => {
      const result = filter.classify('package.json');

      expect(result.include).toBe(false);
      expect(result.rule).toBeUndefined();
    });

    it('should skip tsconfig.json, Dockerfile, and markdown', () => {
      expect(filter.classify('tsconfig.json').include).toBe(false);
      expect(filter.classify('Dockerfile').include).toBe(false);
      expect(filter.classify('README.md').include).toBe(false);
    });
  });

  describe('filter() over a file list', () => {
    it('should include allowed files, skip non-source silently, and warn on deny-list', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      try {
        const files = [
          'src/users/users.controller.ts',
          '.env',
          'package.json',
          'src/users/users.service.ts',
        ];
        const included = filter.filter(files);

        expect(included).toEqual(['src/users/users.controller.ts', 'src/users/users.service.ts']);
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });
  });
});
