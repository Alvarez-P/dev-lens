import { ParsedFile } from '../parsed-file.vo';
import { ParseResult } from '../parse-result.vo';

export interface LanguageParser {
  parse(file: ParsedFile): ParseResult;
}
