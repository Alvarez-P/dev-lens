import { HtmlRenderer } from '@/modules/documentation/infrastructure/renderers/html.renderer';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { GeneratedDocument } from '@/modules/documentation/domain/doc-document';

/**
 * Task 2.2 (PR1) — HtmlRenderer (documentation-formats R3). Accepts Markdown
 * output and converts to a self-contained HTML5 document: <head> with meta
 * charset/viewport/title, default CSS, and a Mermaid client-side renderer
 * script reference so ```mermaid blocks survive as
 * <pre><code class="language-mermaid">.
 */
describe('HtmlRenderer — markdown → self-contained HTML', () => {
  let renderer: HtmlRenderer;

  beforeEach(() => {
    renderer = new HtmlRenderer();
  });

  const makeDoc = (markdown: string): GeneratedDocument => ({
    docType: DocType.README,
    templateVersion: '1',
    title: 'README',
    repositoryId: 'repo-1',
    commitSha: 'abc123',
    generatedAt: '2026-01-01T00:00:00.000Z',
    sections: [
      {
        id: 'intro',
        title: 'Intro',
        format: SectionFormat.MARKDOWN,
        content: { markdown },
      },
    ],
  });

  it('should produce a valid HTML5 document with head metadata', () => {
    const artifact = renderer.render(makeDoc('# README\n\nHello'));

    const html = artifact.buffer.toString('utf8');

    expect(artifact.format).toBe(DocFormat.HTML);
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('<title>README</title>');
  });

  it('should convert markdown structures (headings, tables, lists) to HTML', () => {
    const markdown = [
      '## Endpoints',
      '',
      '| method | path |',
      '| ---- | ---- |',
      '| GET | /users |',
      '',
      '- one',
      '- two',
    ].join('\n');

    const html = renderer.render(makeDoc(markdown)).buffer.toString('utf8');

    expect(html).toContain('<h2>Endpoints</h2>');
    expect(html).toContain('<table>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
  });

  it('should preserve mermaid code blocks for client-side rendering', () => {
    const markdown = '## Model\n\n```mermaid\nclassDiagram\nclass User\n```';
    const html = renderer.render(makeDoc(markdown)).buffer.toString('utf8');

    expect(html).toContain('<pre><code class="language-mermaid">');
    expect(html).toMatch(/language-mermaid[^>]*>\s*classDiagram/);
  });

  it('should include a Mermaid client-side renderer script reference', () => {
    const html = renderer.render(makeDoc('# README')).buffer.toString('utf8');

    expect(html).toMatch(/<script[^>]*mermaid[^>]*>/i);
    expect(html).toContain('</html>');
  });
});
