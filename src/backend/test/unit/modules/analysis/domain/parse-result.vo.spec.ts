import { Language } from '@/modules/analysis/domain/language.vo';
import { ParsedFile } from '@/modules/analysis/domain/parsed-file.vo';
import {
  Diagnostic,
  DiagnosticSeverity,
  ParseResult,
} from '@/modules/analysis/domain/parse-result.vo';

describe('ParsedFile', () => {
  const language = Language.create('typescript', '.ts');

  describe('create', () => {
    it('should create a ParsedFile with path, content and language', () => {
      const file = ParsedFile.create({
        path: '/repo/src/controller.ts',
        content: 'export class A {}',
        language,
      });

      expect(file.path).toBe('/repo/src/controller.ts');
      expect(file.content).toBe('export class A {}');
      expect(file.language).toBe(language);
    });

    it('should reject an empty path', () => {
      expect(() => ParsedFile.create({ path: '', content: 'x', language })).toThrow(
        'Path must not be empty',
      );
    });
  });

  describe('equality', () => {
    it('should be equal for identical path, content and language', () => {
      const a = ParsedFile.create({ path: '/a.ts', content: 'x', language });
      const b = ParsedFile.create({ path: '/a.ts', content: 'x', language });

      expect(a.equals(b)).toBe(true);
    });

    it('should not be equal for different content', () => {
      const a = ParsedFile.create({ path: '/a.ts', content: 'x', language });
      const b = ParsedFile.create({ path: '/a.ts', content: 'y', language });

      expect(a.equals(b)).toBe(false);
    });
  });
});

describe('Diagnostic', () => {
  describe('create', () => {
    it('should create a Diagnostic with severity, message and line', () => {
      const diagnostic = Diagnostic.create({
        severity: DiagnosticSeverity.Error,
        message: 'Unexpected token',
        line: 3,
      });

      expect(diagnostic.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostic.message).toBe('Unexpected token');
      expect(diagnostic.line).toBe(3);
    });

    it('should reject a line below 1', () => {
      expect(() =>
        Diagnostic.create({
          severity: DiagnosticSeverity.Warning,
          message: 'x',
          line: 0,
        }),
      ).toThrow('Line must be a positive integer');
    });
  });
});

describe('ParseResult', () => {
  const language = Language.create('typescript', '.ts');

  describe('success', () => {
    it('should create a ParseResult with ast and empty diagnostics', () => {
      const result = ParseResult.success({
        filePath: '/repo/src/controller.ts',
        language,
        ast: { kind: 'SourceFile' },
      });

      expect(result.filePath).toBe('/repo/src/controller.ts');
      expect(result.language).toBe(language);
      expect(result.ast).toEqual({ kind: 'SourceFile' });
      expect(result.diagnostics).toEqual([]);
      expect(result.metadata).toEqual({});
    });

    it('should attach metadata', () => {
      const result = ParseResult.success({
        filePath: '/a.ts',
        language,
        ast: {},
        metadata: { roles: ['controller'] },
      });

      expect(result.metadata).toEqual({ roles: ['controller'] });
    });
  });

  describe('failure', () => {
    it('should create a ParseResult with null ast and diagnostics', () => {
      const diagnostic = Diagnostic.create({
        severity: DiagnosticSeverity.Error,
        message: 'Syntax error',
        line: 1,
      });

      const result = ParseResult.failure({
        filePath: '/repo/src/broken.ts',
        language,
        diagnostics: [diagnostic],
      });

      expect(result.filePath).toBe('/repo/src/broken.ts');
      expect(result.ast).toBeNull();
      expect(result.diagnostics).toEqual([diagnostic]);
    });
  });
});
