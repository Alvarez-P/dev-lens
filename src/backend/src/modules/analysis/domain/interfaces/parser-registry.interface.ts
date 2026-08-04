import { Language } from '../language.vo';
import { LanguageParser } from './language-parser.interface';

export interface ParserRegistry {
  register(language: Language, parser: LanguageParser): void;

  get(identifier: string): LanguageParser;
}
