import { Language } from '@/modules/analysis/domain/language.vo';
import { ParsedFile } from '@/modules/analysis/domain/parsed-file.vo';
import { ParseResult } from '@/modules/analysis/domain/parse-result.vo';
import { LanguageParser } from '@/modules/analysis/domain/interfaces/language-parser.interface';
import { InMemoryParserRegistry } from '@/modules/analysis/infrastructure/parsers/parser-registry';
import { UnknownLanguageError } from '@/modules/analysis/domain/analysis-errors';

describe('InMemoryParserRegistry', () => {
  const typescript = Language.create('typescript', '.ts');
  const javascript = Language.create('javascript', '.js');

  const parser: LanguageParser = {
    parse: (file: ParsedFile): ParseResult =>
      ParseResult.success({ filePath: file.path, language: file.language, ast: {} }),
  };

  describe('register', () => {
    it('should store a parser for a language', () => {
      const registry = new InMemoryParserRegistry();

      registry.register(typescript, parser);

      expect(registry.get(typescript.name)).toBe(parser);
    });
  });

  describe('get', () => {
    it('should return the parser registered for a language identifier', () => {
      const registry = new InMemoryParserRegistry();

      registry.register(typescript, parser);

      expect(registry.get('typescript')).toBe(parser);
    });

    it('should throw UnknownLanguageError for an unregistered language', () => {
      const registry = new InMemoryParserRegistry();

      expect(() => registry.get('go')).toThrow(UnknownLanguageError);
      expect(() => registry.get('go')).toThrow('No parser registered for language "go"');
    });

    it('should allow multiple languages with distinct parsers', () => {
      const registry = new InMemoryParserRegistry();
      const jsParser: LanguageParser = {
        parse: (file: ParsedFile): ParseResult =>
          ParseResult.success({
            filePath: file.path,
            language: file.language,
            ast: { kind: 'js' },
          }),
      };

      registry.register(typescript, parser);
      registry.register(javascript, jsParser);

      expect(registry.get('typescript')).toBe(parser);
      expect(registry.get('javascript')).toBe(jsParser);
    });
  });
});
