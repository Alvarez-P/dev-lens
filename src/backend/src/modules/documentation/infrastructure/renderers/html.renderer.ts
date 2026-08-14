import { marked } from 'marked';
import { DocFormat } from '../../domain/doc-format.enum';
import { GeneratedDocument } from '../../domain/doc-document';
import { IDocFormatRenderer, RenderedArtifact } from './renderer.interface';
import { renderSectionMarkdown } from './markdown.renderer';

const DEFAULT_CSS = `
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1f2328; max-width: 900px; margin: 0 auto; padding: 2rem; }
h1, h2, h3 { line-height: 1.25; }
pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 4px; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #d0d7de; padding: 0.4rem 0.6rem; text-align: left; }
th { background: #f6f8fa; }
a { color: #0969da; }
`.trim();

const MERMAID_SCRIPT = `
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>
  if (window.mermaid) {
    mermaid.initialize({ startOnLoad: true });
  }
</script>
`;

/**
 * HtmlRenderer (documentation-formats R3) — document-level `html` format.
 * Renders the doc's sections to Markdown, converts via `marked`, and wraps
 * the result in a self-contained HTML5 document with meta charset/viewport,
 * title, default CSS, and a Mermaid client-side renderer script reference.
 */
export class HtmlRenderer implements IDocFormatRenderer {
  readonly format = DocFormat.HTML;

  render(doc: GeneratedDocument): RenderedArtifact {
    const markdown = doc.sections.map(renderSectionMarkdown).filter(Boolean).join('\n\n');
    const body = marked.parse(markdown) as string;

    const html = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${escapeHtml(doc.title)}</title>`,
      `<style>${DEFAULT_CSS}</style>`,
      '</head>',
      '<body>',
      body,
      MERMAID_SCRIPT,
      '</body>',
      '</html>',
    ].join('\n');

    return {
      format: DocFormat.HTML,
      contentType: 'text/html',
      ext: 'html',
      buffer: Buffer.from(html, 'utf8'),
    };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
