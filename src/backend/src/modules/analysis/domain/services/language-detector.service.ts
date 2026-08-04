import { Language } from '../language.vo';

const EXTENSION_TO_LANGUAGE: ReadonlyMap<string, string> = new Map([
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
  ['.js', 'javascript'],
  ['.jsx', 'javascript'],
]);

export class LanguageDetector {
  detect(filePath: string): Language | null {
    const dotIndex = filePath.lastIndexOf('.');

    if (dotIndex < 0) {
      return null;
    }

    const extension = filePath.slice(dotIndex).toLowerCase();
    const name = EXTENSION_TO_LANGUAGE.get(extension);

    if (name === undefined) {
      return null;
    }

    return Language.create(name, extension);
  }

  detectMany(filePaths: string[]): Map<Language, string[]> {
    const byName: Map<string, { language: Language; files: string[] }> = new Map();

    for (const filePath of filePaths) {
      const language = this.detect(filePath);

      if (language === null) {
        continue;
      }

      const entry = byName.get(language.name) ?? { language, files: [] };
      entry.files.push(filePath);
      byName.set(language.name, entry);
    }

    const groups: Map<Language, string[]> = new Map();

    for (const entry of byName.values()) {
      groups.set(entry.language, entry.files);
    }

    return groups;
  }
}
