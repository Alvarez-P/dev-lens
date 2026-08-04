import { Language } from '@/modules/analysis/domain';
import { ParsedFile } from '@/modules/analysis/domain';
import { ParseResult, Diagnostic, DiagnosticSeverity } from '@/modules/analysis/domain';
import { LanguageDetector } from '@/modules/analysis/domain';
import {
  AnalysisStartedEvent,
  AnalysisCompletedEvent,
  AnalysisFailedEvent,
} from '@/modules/analysis/domain';
import { UnknownLanguageError } from '@/modules/analysis/domain';

describe('Analysis domain index exports', () => {
  it('should export the Language VO', () => {
    const language = Language.create('typescript', '.ts');

    expect(language.toString()).toBe('typescript');
  });

  it('should export ParsedFile and ParseResult VOs', () => {
    const language = Language.create('typescript', '.ts');
    const file = ParsedFile.create({ path: '/a.ts', content: 'x', language });
    const result = ParseResult.success({ filePath: file.path, language, ast: {} });

    expect(result.isSuccess).toBe(true);
  });

  it('should export Diagnostic and DiagnosticSeverity', () => {
    const diagnostic = Diagnostic.create({
      severity: DiagnosticSeverity.Error,
      message: 'boom',
      line: 1,
    });

    expect(diagnostic.severity).toBe('error');
  });

  it('should export the LanguageDetector service', () => {
    const detector = new LanguageDetector();

    expect(detector.detect('a.ts')?.toString()).toBe('typescript');
  });

  it('should export analysis events', () => {
    expect(new AnalysisStartedEvent('s', 'r', null, 'c').eventType).toBe('analysis.started');
    expect(new AnalysisCompletedEvent('s', 'r', null, 'c', 'a').eventType).toBe(
      'analysis.completed',
    );
    expect(new AnalysisFailedEvent('s', 'r', null, 'c', 'e').eventType).toBe('analysis.failed');
  });

  it('should export UnknownLanguageError', () => {
    const error = new UnknownLanguageError('go');

    expect(error.code).toBe('UNKNOWN_LANGUAGE');
    expect(error.message).toContain('go');
  });
});
