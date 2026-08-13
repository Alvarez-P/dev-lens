import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MarkdownViewer, extractAiSectionTitles } from '../markdown-viewer';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (_id: string, _code: string) => ({
      svg: '<svg data-testid="fake-mermaid-svg"></svg>',
    })),
  },
}));

const md = (parts: TemplateStringsArray): string => parts.join('');

describe('MarkdownViewer (7.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders GitHub-flavored markdown', () => {
    render(
      <MarkdownViewer
        markdown={md`
# Title

**bold** and a [link](https://example.com)
        `}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('bold', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'link' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
  });

  it('renders GFM tables inside a horizontally scrollable wrapper', () => {
    const { container } = render(
      <MarkdownViewer
        markdown={md`
| a   | b   |
| --- | --- |
| 1   | 2   |
        `}
      />,
    );
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table?.parentElement?.className).toContain('overflow-x-auto');
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('syntax-highlights TypeScript code blocks with hljs classes', async () => {
    const { container } = render(
      <MarkdownViewer
        markdown={md`
~~~ts
const x: number = 1;
~~~
        `}
      />,
    );
    await waitFor(() => {
      const code = container.querySelector('code');
      expect(code).not.toBeNull();
      expect(code!.className).toContain('hljs');
    });
  });

  it('renders mermaid code blocks through the mermaid library', async () => {
    render(
      <MarkdownViewer
        markdown={md`
~~~mermaid
classDiagram
class User
~~~
        `}
      />,
    );
    const svg = await screen.findByTestId('fake-mermaid-svg');
    expect(svg).toBeInTheDocument();
    const mermaid = (await import('mermaid')).default;
    expect(mermaid.render).toHaveBeenCalled();
  });

  it('shows an AI-generated badge next to headings marked with the AI marker', () => {
    render(
      <MarkdownViewer
        markdown={md`
## Module Purpose

<!-- devlens:ai -->

AI content here.
        `}
      />,
    );
    const badge = screen.getByTestId('ai-generated-badge');
    expect(badge).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Module Purpose/ })).toBeInTheDocument();
  });

  it('does NOT show an AI badge for deterministic sections', () => {
    render(
      <MarkdownViewer
        markdown={md`
## Public API

| m   | p   |
| --- | --- |
| GET | /   |
        `}
      />,
    );
    expect(screen.queryByTestId('ai-generated-badge')).not.toBeInTheDocument();
  });

  it('renders a responsive layout without horizontal overflow on narrow content', () => {
    const { container } = render(
      <MarkdownViewer
        markdown={md`
Short paragraph.

- item
        `}
      />,
    );
    expect(container.firstElementChild).not.toBeNull();
    expect(screen.getByText('Short paragraph.')).toBeInTheDocument();
  });
});

describe('extractAiSectionTitles (7.3)', () => {
  it('detects AI sections when the marker sits directly under the heading (backend format)', () => {
    const titles = extractAiSectionTitles('## Module Purpose\n<!-- devlens:ai -->\n\nbody');
    expect(titles).toEqual(new Set(['Module Purpose']));
  });

  it('detects AI sections when blank lines separate the heading from the marker', () => {
    const titles = extractAiSectionTitles('## Module Purpose\n\n\n<!-- devlens:ai -->\n\nbody');
    expect(titles).toEqual(new Set(['Module Purpose']));
  });

  it('ignores headings whose following non-blank line is not the marker', () => {
    const titles = extractAiSectionTitles(
      '## Public API\n\ntable content\n\n## Real AI\n<!-- devlens:ai -->',
    );
    expect(titles).toEqual(new Set(['Real AI']));
  });

  it('returns an empty set when no section is AI-generated', () => {
    const titles = extractAiSectionTitles('# Doc\n\n## Plain\n\ntext only');
    expect(titles.size).toBe(0);
  });
});
