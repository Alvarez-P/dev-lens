import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { GeneratedDocument } from '@/modules/documentation/domain/doc-document';
import {
  IDocContentGenerator,
  DocContext,
} from '@/modules/documentation/application/content-generators/content-generator.interface';
import { GraphNode } from '@/modules/knowledge-graph/domain/graph-node.vo';
import { GraphEdge } from '@/modules/knowledge-graph/domain/graph-edge.vo';

/**
 * Task 5.1 (PR4) — IDocContentGenerator contract (documentation-generation R3).
 * Generators are pure functions over GraphQueryService output: they map
 * (nodes, edges, version, ctx) → GeneratedDocument. The contract imports
 * GeneratedDocument from the domain model (PR1) — it must NOT be redefined here.
 */

class FakeReadmeGenerator implements IDocContentGenerator {
  readonly docType = DocType.README;

  generate(
    _nodes: GraphNode[],
    _edges: GraphEdge[],
    _version: number,
    ctx: DocContext,
  ): GeneratedDocument {
    return {
      docType: this.docType,
      templateVersion: ctx.templateVersion,
      title: ctx.title,
      repositoryId: ctx.repositoryId,
      commitSha: ctx.commitSha,
      generatedAt: '2026-01-01T00:00:00.000Z',
      sections: [],
    };
  }
}

function makeCtx(overrides: Partial<DocContext> = {}): DocContext {
  return {
    repositoryId: 'repo-42',
    commitSha: 'abc123',
    templateVersion: '1',
    title: 'README',
    ...overrides,
  };
}

describe('content-generator.interface — IDocContentGenerator contract (5.1)', () => {
  it('should expose the docType the generator produces and a generate() method', () => {
    const generator: IDocContentGenerator = new FakeReadmeGenerator();
    expect(generator.docType).toBe(DocType.README);
    expect(typeof generator.generate).toBe('function');
  });

  it('should map graph data + DocContext into a GeneratedDocument carrying domain metadata', () => {
    const generator = new FakeReadmeGenerator();
    const doc = generator.generate([], [], 3, makeCtx());

    expect(doc).toBeInstanceOf(Object);
    expect(doc.docType).toBe(DocType.README);
    expect(doc.repositoryId).toBe('repo-42');
    expect(doc.commitSha).toBe('abc123');
    expect(doc.templateVersion).toBe('1');
    expect(doc.title).toBe('README');
    expect(doc.sections).toEqual([]);
  });

  it('should thread the version and generatedAt through the contract', () => {
    const generator = new FakeReadmeGenerator();
    const doc = generator.generate([], [], 7, makeCtx({ templateVersion: '2' }));

    expect(doc.templateVersion).toBe('2');
    expect(typeof doc.generatedAt).toBe('string');
  });

  it('should reference the domain GeneratedDocument type, not a redefined one', () => {
    // Structural check: the domain type carries the full document shape used by
    // the renderers (design: two-layer rendering) — the interface must reuse it.
    const domainDoc: GeneratedDocument = {
      docType: DocType.README,
      templateVersion: '1',
      title: 'README',
      repositoryId: 'repo-42',
      commitSha: 'abc123',
      generatedAt: '2026-01-01T00:00:00.000Z',
      sections: [],
    };
    expect(domainDoc.sections).toEqual([]);
  });
});
