import { DocType } from '../../domain/doc-type.enum';
import { GeneratedDocument } from '../../domain/doc-document';
import { GraphNode } from '../../../knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '../../../knowledge-graph/domain/graph-edge.vo';

/**
 * Context handed to a content generator when producing a GeneratedDocument
 * (documentation-generation R3). The generator fills in the domain metadata
 * fields (docType is the generator's own key) while the pipeline supplies the
 * repository/commit identity and the template version that was selected.
 */
export interface DocContext {
  repositoryId: string;
  commitSha: string;
  templateVersion: string;
  title: string;
}

/**
 * Content generator contract (documentation-generation R3). A generator is a
 * pure function over the Knowledge Graph output (`findAllNodesAndEdges`) that
 * produces the structured `GeneratedDocument` handed to the renderers. It is
 * keyed by the doc type it produces (template R2/R4: one generator per built-in
 * template type).
 *
 * The shared document model (`GeneratedDocument`/`DocSection`) lives in the
 * domain layer (PR1) — this interface only imports it, never redefines it.
 */
export interface IDocContentGenerator {
  readonly docType: DocType;
  generate(
    nodes: GraphNode[],
    edges: GraphEdge[],
    version: number,
    ctx: DocContext,
  ): GeneratedDocument;
}
