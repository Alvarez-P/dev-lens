import { Language } from '@/modules/analysis/domain/language.vo';
import { ParsedFile } from '@/modules/analysis/domain/parsed-file.vo';
import { ParseResult } from '@/modules/analysis/domain/parse-result.vo';
import { LanguageParser } from '@/modules/analysis/domain/interfaces/language-parser.interface';
import { ParserRegistry } from '@/modules/analysis/domain/interfaces/parser-registry.interface';

describe('LanguageParser contract', () => {
  const language = Language.create('typescript', '.ts');

  it('should accept a parser whose parse method conforms to the contract', async () => {
    const parser: LanguageParser = {
      parse: (file: ParsedFile): ParseResult =>
        ParseResult.success({ filePath: file.path, language: file.language, ast: {} }),
    };

    const file = ParsedFile.create({
      path: '/repo/src/a.ts',
      content: 'export const x = 1;',
      language,
    });

    const result = await parser.parse(file);

    expect(result.filePath).toBe('/repo/src/a.ts');
    expect(result.language).toBe(language);
    expect(result.diagnostics).toEqual([]);
    expect(result.isSuccess).toBe(true);
  });
});

describe('ParserRegistry contract', () => {
  const language = Language.create('typescript', '.ts');
  const parser: LanguageParser = {
    parse: (file: ParsedFile): ParseResult =>
      ParseResult.success({ filePath: file.path, language: file.language, ast: {} }),
  };

  it('should accept a registry keyed by language name string', () => {
    const registry: ParserRegistry = {
      register: (lang: Language, p: LanguageParser) => undefined,
      get: (identifier: string): LanguageParser => parser,
    };

    registry.register(language, parser);

    expect(registry.get('typescript')).toBe(parser);
  });

  it('should resolve a registered parser by identifier', () => {
    const registry: ParserRegistry = {
      register: () => undefined,
      get: (identifier: string): LanguageParser => parser,
    };

    const resolved: LanguageParser = registry.get('typescript');

    expect(resolved).toBe(parser);
  });
});
