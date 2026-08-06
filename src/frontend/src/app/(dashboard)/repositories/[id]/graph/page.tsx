import type { Metadata } from 'next';
import { GraphWorkspace } from '@/components/graph/graph-workspace';

export const metadata: Metadata = {
  title: 'Graph — DevLens',
  description:
    'Interactive knowledge-graph visualization: architectural views, filtering, search and drill-down.',
};

interface GraphPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Graph route — server shell (VE-001): resolves the repository id and renders
 * the client-side `GraphWorkspace`. All data loading and interaction happens
 * in the workspace; this page only owns the route + metadata.
 */
export default async function GraphPage({ params }: GraphPageProps): Promise<React.ReactNode> {
  const { id } = await params;

  return (
    <div className="-m-6 h-[calc(100%+3rem)] overflow-hidden">
      <GraphWorkspace repoId={id} className="h-full" />
    </div>
  );
}
