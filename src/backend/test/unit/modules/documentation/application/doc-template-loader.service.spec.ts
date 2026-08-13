import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { DocTemplateLoaderService } from '@/modules/documentation/application/doc-template-loader.service';
import { DocTemplateParseError } from '@/modules/documentation/domain/doc-template';

/**
 * Task 3.1 (PR2) — template loader scanning `templates/{type}/v{n}/template.yml`
 * (documentation-template-system R1/R6). Corrupt or malformed template files
 * fail fast at load time — module initialization must fail, never silently
 * skip. Mirrors the PromptTemplateLoader (ai/application) conventions.
 */
describe('DocTemplateLoaderService (3.1) — templates/{type}/v{n}/template.yml scan', () => {
  let baseDir: string;
  let loader: DocTemplateLoaderService;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'doc-templates-'));
    loader = new DocTemplateLoaderService(baseDir);
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  function writeTemplate(type: string, version: number, yaml: string): string {
    const dir = join(baseDir, type, `v${version}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'template.yml');
    writeFileSync(file, yaml);
    return file;
  }

  function validTemplateYaml(id: string, version = 1, extraSections = ''): string {
    return [
      `id: ${id}`,
      `name: ${id} docs`,
      `version: ${version}`,
      'sections:',
      '  - id: overview',
      '    title: Overview',
      "    source: 'graph.exports()'",
      '    format: table',
      extraSections,
    ].join('\n');
  }

  describe('scanning (R6)', () => {
    it('loads every {type}/v{n}/template.yml found under the base dir', () => {
      writeTemplate('readme', 1, validTemplateYaml('readme'));
      writeTemplate('readme', 2, validTemplateYaml('readme', 2));
      writeTemplate('api-reference', 1, validTemplateYaml('api-reference'));

      const templates = loader.loadAll();

      expect(templates).toHaveLength(3);
      expect(templates.map((t) => `${t.id}@${t.version}`).sort()).toEqual([
        'api-reference@1',
        'readme@1',
        'readme@2',
      ]);
    });

    it('keeps the full filesystem path of each parsed template', () => {
      const file = writeTemplate('readme', 1, validTemplateYaml('readme'));

      const [template] = loader.loadAll();

      expect(template.sourcePath).toBe(file);
      expect(template.sourcePath).toMatch(/readme[/\\]v1[/\\]template\.yml$/);
    });

    it('skips stray files and directories that are not {type}/v{n} layout', () => {
      writeTemplate('readme', 1, validTemplateYaml('readme'));
      writeFileSync(join(baseDir, 'notes.txt'), 'not a template');
      mkdirSync(join(baseDir, 'scratch', 'files'), { recursive: true });
      writeFileSync(join(baseDir, 'scratch', 'files', 'template.yml'), 'irrelevant');

      const templates = loader.loadAll();

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('readme');
    });

    it('returns an empty list when the base dir exists but contains no templates', () => {
      expect(loader.loadAll()).toEqual([]);
    });

    it('throws a descriptive error when the templates base dir does not exist', () => {
      const missing = new DocTemplateLoaderService(join(baseDir, 'does-not-exist'));

      expect(() => missing.loadAll()).toThrow(/does-not-exist/);
    });
  });

  describe('corrupt-file fail-fast (R6)', () => {
    it('throws a parse error carrying the file path when the YAML is invalid', () => {
      const file = writeTemplate('broken', 1, 'version: [unclosed');

      expect(() => loader.loadAll()).toThrow(DocTemplateParseError);
      expect(() => loader.loadAll()).toThrow(/broken[/\\]v1[/\\]template\.yml/);
      expect(file).toContain('broken');
    });

    it('throws a parse error identifying the missing field and path (R1)', () => {
      writeTemplate(
        'missing-version',
        1,
        ['id: readme', 'name: README', 'sections: []'].join('\n'),
      );

      expect(() => loader.loadAll()).toThrow(/missing required field: version/);
      expect(() => loader.loadAll()).toThrow(/missing-version/);
    });

    it('throws when a version directory exists but contains no template.yml', () => {
      mkdirSync(join(baseDir, 'readme', 'v1'), { recursive: true });

      expect(() => loader.loadAll()).toThrow(/missing template\.yml/);
      expect(() => loader.loadAll()).toThrow(/readme[/\\]v1/);
    });

    it('throws when the template id does not match its type directory', () => {
      writeTemplate('api-reference', 1, validTemplateYaml('readme'));

      expect(() => loader.loadAll()).toThrow(/does not match its type directory/);
      expect(() => loader.loadAll()).toThrow(/'readme'/);
    });
  });
});
