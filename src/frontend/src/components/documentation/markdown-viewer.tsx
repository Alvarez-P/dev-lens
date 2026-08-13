'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Machine-readable marker emitted by the backend MarkdownRenderer next to
 * AI-enriched section headings (views R6). Same value as the backend
 * `AI_SECTION_MARKER` in markdown.renderer.ts.
 */
export const AI_SECTION_MARKER = '<!-- devlens:ai -->';

export interface MarkdownViewerProps {
  markdown: string;
  className?: string;
}

/** Extract the plain text from a React node tree (heading children). */
function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(nodeText).join('');
  }
  if (node !== null && typeof node === 'object' && 'props' in node) {
    return nodeText((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

/**
 * Scan the raw markdown for headings directly followed by the AI marker and
 * return the set of section titles that are AI-generated (views R6).
 */
export function extractAiSectionTitles(markdown: string): Set<string> {
  const titles = new Set<string>();
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i]);
    if (!match) continue;
    if (lines[i + 1].includes(AI_SECTION_MARKER)) {
      titles.add(match[2].trim());
    }
  }
  return titles;
}

/** Mermaid diagram that renders client-side on mount (views R3). */
function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
        const id = `mmd-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (failed) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-error-500/20 bg-surface-950 p-4 text-sm text-error-300">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      data-testid="mermaid-diagram"
      className="my-4 flex justify-center overflow-x-auto rounded-lg border border-white/[0.06] bg-surface-950/60 p-4 [&_svg]:max-w-none"
    />
  );
}

/**
 * Client-side Markdown viewer (views R3, R6). Renders GitHub-flavored
 * Markdown with syntax-highlighted code blocks, Mermaid diagrams (rendered by
 * the client-side mermaid library), responsive tables, and an "AI-generated"
 * badge next to any section whose heading carries the backend AI marker.
 */
export function MarkdownViewer({ markdown, className }: MarkdownViewerProps): React.ReactNode {
  const aiTitles = extractAiSectionTitles(markdown);

  const components: Components = {
    // AI badge (R6): small, non-intrusive label adjacent to the heading.
    h2: ({ children }) => {
      const text = nodeText(children).trim();
      const isAi = aiTitles.has(text);
      return (
        <h2 className="mt-8 mb-3 flex items-center gap-2 text-xl font-semibold text-surface-100">
          {children}
          {isAi && (
            <span
              data-testid="ai-generated-badge"
              className="inline-flex items-center gap-1 rounded-full border border-primary-500/30 bg-primary-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-300"
            >
              <Sparkles className="h-3 w-3" />
              AI-generated
            </span>
          )}
        </h2>
      );
    },
    h3: ({ children }) => (
      <h3 className="mt-6 mb-2 text-lg font-semibold text-surface-200">{children}</h3>
    ),
    p: ({ children }) => <p className="mb-4 leading-relaxed text-surface-300">{children}</p>,
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary-400 underline decoration-primary-500/40 underline-offset-2 hover:text-primary-300"
      >
        {children}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="mb-4 list-disc space-y-1 pl-6 text-surface-300">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-4 list-decimal space-y-1 pl-6 text-surface-300">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="mb-4 border-l-2 border-primary-500/40 bg-white/[0.02] py-2 pl-4 text-surface-400">
        {children}
      </blockquote>
    ),
    // Responsive tables: horizontally scrollable within their container (R3).
    table: ({ children }) => (
      <div className="mb-4 overflow-x-auto rounded-lg border border-white/[0.06]">
        <table className="w-full border-collapse text-sm text-surface-300">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-b border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left font-semibold text-surface-200">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-white/[0.04] px-3 py-2 align-top">{children}</td>
    ),
    code: ({ className, children }) => {
      const isMermaid = className?.includes('language-mermaid');
      const text = String(children).replace(/\n$/, '');
      if (isMermaid) {
        return <MermaidBlock code={text} />;
      }
      if (className) {
        // Fenced code block with a language → rehype-highlight has applied hljs classes.
        return (
          <pre className="mb-4 overflow-x-auto rounded-lg border border-white/[0.06] bg-surface-950 p-4 text-sm">
            <code className={className}>{children}</code>
          </pre>
        );
      }
      return (
        <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-primary-200">
          {children}
        </code>
      );
    },
  };

  return (
    <div
      data-testid="markdown-viewer"
      className={clsx(
        // Style imported from globals.css — prose-like typography for docs.
        'text-surface-300',
        '[&_pre]:font-mono',
        className,
      )}
    >
      <style>{`
        .hljs { color: #e2e8f0; background: transparent; }
        .hljs-keyword, .hljs-selector-tag { color: #c792ea; }
        .hljs-string, .hljs-attr { color: #a5e075; }
        .hljs-title, .hljs-function { color: #82aaff; }
        .hljs-number, .hljs-literal { color: #f78c6c; }
        .hljs-comment { color: #637777; font-style: italic; }
        .hljs-built_in, .hljs-type { color: #ffcb6b; }
        .hljs-params { color: #e2e8f0; }
        .hljs-meta { color: #89ddff; }
      `}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {markdown.replaceAll(AI_SECTION_MARKER, '')}
      </ReactMarkdown>
    </div>
  );
}
