import { DocFormat } from '../../domain/doc-format.enum';
import { SectionFormat } from '../../domain/doc-template';
import { GeneratedDocument, DocSection } from '../../domain/doc-document';
import { IDocFormatRenderer, RenderedArtifact } from './renderer.interface';
import { renderClassDiagram, renderFlowchart } from './mermaid.renderer';
import { renderPlantUmlClassDiagram } from './plantuml.renderer';

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  }
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function tableHeaders(
  columns: string[] | undefined,
  rows: Array<Record<string, unknown>>,
): string[] {
  if (columns && columns.length > 0) {
    return columns;
  }
  const keys: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }
  return keys;
}

function renderTable(section: DocSection): string {
  const content = section.content as { columns?: string[]; rows: Array<Record<string, unknown>> };
  const headers = tableHeaders(content.columns, content.rows);
  if (headers.length === 0) {
    return '';
  }

  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '----').join(' | ')} |`,
    ...content.rows.map((row) => `| ${headers.map((h) => escapeCell(row[h])).join(' | ')} |`),
  ];
  return lines.join('\n');
}

function renderList(section: DocSection): string {
  const content = section.content as { items: unknown[] };
  return content.items.map((item) => `- ${escapeCell(item)}`).join('\n');
}

function fence(language: string, body: string): string {
  return ['```' + language, body, '```'].join('\n');
}

/** Section-level fragments (design: two-layer rendering). */
export function renderSectionMarkdown(section: DocSection): string {
  const title = section.title ? `## ${section.title}\n\n` : '';

  switch (section.format) {
    case SectionFormat.TABLE: {
      const body = renderTable(section);
      return body ? title + body : '';
    }
    case SectionFormat.LIST: {
      const body = renderList(section);
      return body ? title + body : '';
    }
    case SectionFormat.MERMAID_CLASS_DIAGRAM: {
      const content = section.content as {
        entities: Array<{ name: string; attributes: string[]; methods: string[] }>;
        relationships: Array<{
          from: string;
          to: string;
          kind: 'inheritance' | 'composition' | 'aggregation' | 'association';
          label?: string;
        }>;
      };
      return title + fence('mermaid', renderClassDiagram(content.entities, content.relationships));
    }
    case SectionFormat.MERMAID_FLOWCHART: {
      const content = section.content as {
        nodes: Array<{ id: string; label?: string }>;
        edges: Array<{ from: string; to: string; label?: string }>;
      };
      return title + fence('mermaid', renderFlowchart(content.nodes, content.edges));
    }
    case SectionFormat.PLANTUML: {
      const content = section.content as {
        entities: Array<{ name: string; attributes: string[]; methods: string[] }>;
        relationships: Array<{
          from: string;
          to: string;
          kind: 'inheritance' | 'composition' | 'aggregation' | 'association';
          label?: string;
        }>;
      };
      return (
        title +
        fence('plantuml', renderPlantUmlClassDiagram(content.entities, content.relationships))
      );
    }
    case SectionFormat.MARKDOWN: {
      const content = section.content as { markdown: string };
      return title + content.markdown;
    }
    case SectionFormat.JSON: {
      const content = section.content as { data: unknown };
      return title + fence('json', JSON.stringify(content.data, null, 2));
    }
    default:
      // Unrecognized section formats are skipped with a warning (template R3).
      return '';
  }
}

/**
 * MarkdownRenderer (documentation-formats R2) — renders a GeneratedDocument
 * as GitHub-flavored Markdown. Each section becomes a `##`-headed fragment;
 * table/list/mermaid/plantuml/markdown/json formats map to section-level
 * markdown fragments.
 */
export class MarkdownRenderer implements IDocFormatRenderer {
  readonly format = DocFormat.MARKDOWN;

  render(doc: GeneratedDocument): RenderedArtifact {
    const markdown = doc.sections.map(renderSectionMarkdown).filter(Boolean).join('\n\n');
    return {
      format: DocFormat.MARKDOWN,
      contentType: 'text/markdown',
      ext: 'md',
      buffer: Buffer.from(markdown, 'utf8'),
    };
  }
}
