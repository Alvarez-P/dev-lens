import {
  SectionFormat,
  parseDocTemplate,
  DocTemplateParseError,
  type DocTemplate,
} from '@/modules/documentation/domain/doc-template';

/**
 * Task 1.4 (PR1) — YAML template VO (documentation-template-system R1).
 * Every template has id/name/version/sections; sections have id/title/source/
 * format and MAY have condition. Parse errors identify the missing field and
 * the template path.
 */
describe('parseDocTemplate — valid templates', () => {
  const VALID_YAML = [
    'id: readme',
    'name: README',
    'version: 1',
    'sections:',
    '  - id: overview',
    '    title: Project Overview',
    '    source: graph.exports()',
    '    format: table',
    '  - id: architecture',
    '    title: Architecture',
    '    source: graph.entities("core")',
    '    format: mermaid-class-diagram',
    '    condition: has_events',
  ].join('\n');

  it('should parse a valid template with all sections', () => {
    const template: DocTemplate = parseDocTemplate(VALID_YAML, '/templates/readme/v1/template.yml');

    expect(template.id).toBe('readme');
    expect(template.name).toBe('README');
    expect(template.version).toBe(1);
    expect(template.sections).toHaveLength(2);
    expect(template.sections[0]).toEqual({
      id: 'overview',
      title: 'Project Overview',
      source: 'graph.exports()',
      format: 'table',
    });
  });

  it('should preserve the optional condition field on a section', () => {
    const template = parseDocTemplate(VALID_YAML, 'template.yml');
    expect(template.sections[1].condition).toBe('has_events');
    expect(template.sections[0].condition).toBeUndefined();
  });

  it('should keep the source path for error reporting', () => {
    const template = parseDocTemplate(VALID_YAML, 'templates/readme/v1/template.yml');
    expect(template.sourcePath).toBe('templates/readme/v1/template.yml');
  });
});

describe('parseDocTemplate — invalid templates fail fast', () => {
  it('should throw a parse error identifying the missing version field and path', () => {
    const yaml = ['id: readme', 'name: README', 'sections: []'].join('\n');

    expect(() => parseDocTemplate(yaml, 'templates/readme/v1/template.yml')).toThrow(
      DocTemplateParseError,
    );
    try {
      parseDocTemplate(yaml, 'templates/readme/v1/template.yml');
    } catch (error) {
      expect((error as DocTemplateParseError).message).toContain('version');
      expect((error as DocTemplateParseError).message).toContain(
        'templates/readme/v1/template.yml',
      );
    }
  });

  it('should throw when a section is missing its title', () => {
    const yaml = [
      'id: readme',
      'name: README',
      'version: 1',
      'sections:',
      '  - id: overview',
      '    source: graph.exports()',
      '    format: table',
    ].join('\n');

    expect(() => parseDocTemplate(yaml, 'templates/readme/v1/template.yml')).toThrow(
      /sections\[0\] is missing required field: title/,
    );
  });

  it('should throw a descriptive error when the YAML itself is invalid', () => {
    expect(() => parseDocTemplate('version: [unclosed', 'bad/template.yml')).toThrow(
      DocTemplateParseError,
    );
  });
});

describe('SectionFormat', () => {
  it('should expose the seven section-level render formats', () => {
    expect(Object.values(SectionFormat)).toEqual([
      'table',
      'list',
      'mermaid-class-diagram',
      'mermaid-flowchart',
      'plantuml',
      'markdown',
      'json',
    ]);
  });
});
