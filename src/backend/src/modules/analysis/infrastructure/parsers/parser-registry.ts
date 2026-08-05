import { Injectable } from '@nestjs/common';
import { Language } from '../../domain/language.vo';
import { LanguageParser } from '../../domain/interfaces/language-parser.interface';
import { ParserRegistry } from '../../domain/interfaces/parser-registry.interface';
import { UnknownLanguageError } from '../../domain/analysis-errors';

@Injectable()
export class InMemoryParserRegistry implements ParserRegistry {
  private readonly parsersByLanguage: Map<string, LanguageParser> = new Map();

  register(language: Language, parser: LanguageParser): void {
    this.parsersByLanguage.set(language.name, parser);
  }

  get(identifier: string): LanguageParser {
    const parser = this.parsersByLanguage.get(identifier);

    if (parser === undefined) {
      throw new UnknownLanguageError(identifier);
    }

    return parser;
  }
}
