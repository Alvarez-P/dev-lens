import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useGraphStore } from '@/lib/visualization/store/graph-store';
import type { GraphNode } from '@/lib/visualization/types';
import type { GraphRendererAdapter } from '@/lib/visualization/adapter';

/**
 * Ids of the nodes whose label or fqn contains `query` (case-insensitive
 * substring, REQ-VV-003). Returns [] for empty/whitespace queries.
 */
export function findMatches(nodes: GraphNode[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return nodes
    .filter((node) => node.label.toLowerCase().includes(q) || node.fqn.toLowerCase().includes(q))
    .map((node) => node.id);
}

export interface GraphSearchResult {
  /** Current query (mirrors `filterSlice.searchQuery`). */
  query: string;
  /** Replace the query (writes the store so the canvas filters too). */
  setQuery: (query: string) => void;
  clearSearch: () => void;
  /** Ids of the nodes matching the current query, in graph order. */
  matchingNodeIds: string[];
  /** True while a non-empty query is active. */
  isSearching: boolean;
  /** Enter handler: centers the viewport on the first match (REQ-VV-003). */
  submit: () => void;
}

/**
 * Client-side search controller (REQ-VV-003). Matching node ids are derived
 * from the loaded graph; the query lives in the Zustand `filterSlice` so the
 * canvas filter hides non-matching nodes. The adapter is told to highlight
 * the matches (glow ring / dim contrast) and the first match is auto-centered
 * on `submit()`.
 */
export function useGraphSearch(
  nodes: GraphNode[],
  adapterRef?: RefObject<GraphRendererAdapter | null>,
): GraphSearchResult {
  const query = useGraphStore((state) => state.searchQuery);
  const setSearchQuery = useGraphStore((state) => state.setSearchQuery);

  const matchingNodeIds = useMemo(() => findMatches(nodes, query), [nodes, query]);
  const isSearching = query.trim().length > 0;

  const submit = useCallback(() => {
    const first = matchingNodeIds[0];
    if (first) {
      adapterRef?.current?.centerOn(first);
    }
  }, [matchingNodeIds, adapterRef]);

  const wasSearching = useRef(false);

  // Adapter highlight lifecycle: dim everything except the matches while
  // searching; restore when the query clears.
  useEffect(() => {
    const adapter = adapterRef?.current;
    if (!adapter) return;

    if (isSearching) {
      adapter.highlight(matchingNodeIds);
    } else if (wasSearching.current) {
      adapter.clearHighlights();
    }
    wasSearching.current = isSearching;
  }, [isSearching, matchingNodeIds, adapterRef]);

  return {
    query,
    setQuery: setSearchQuery,
    clearSearch: useCallback(() => setSearchQuery(''), [setSearchQuery]),
    matchingNodeIds,
    isSearching,
    submit,
  };
}
