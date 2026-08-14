import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import {
  DOC_FORMAT_POLICY,
  resolveFormats,
} from '@/modules/documentation/application/doc-format-policy';

/**
 * Task 1.3 (PR1) — docType → formats matrix. Design decision 2 keeps the
 * matrix as a module constant: readme → [markdown,html]; architecture-guide →
 * [markdown,html,mermaid]; api-reference → [markdown,html,openapi,json];
 * module-docs → [markdown,html]; onboarding-guide → [markdown,html].
 */
describe('DOC_FORMAT_POLICY', () => {
  it('should map readme to markdown + html', () => {
    expect(DOC_FORMAT_POLICY[DocType.README]).toEqual([DocFormat.MARKDOWN, DocFormat.HTML]);
  });

  it('should map architecture-guide to markdown + html + mermaid', () => {
    expect(DOC_FORMAT_POLICY[DocType.ARCHITECTURE_GUIDE]).toEqual([
      DocFormat.MARKDOWN,
      DocFormat.HTML,
      DocFormat.MERMAID,
    ]);
  });

  it('should map api-reference to markdown + html + openapi + json', () => {
    expect(DOC_FORMAT_POLICY[DocType.API_REFERENCE]).toEqual([
      DocFormat.MARKDOWN,
      DocFormat.HTML,
      DocFormat.OPENAPI,
      DocFormat.JSON,
    ]);
  });

  it('should map module-docs and onboarding-guide to markdown + html', () => {
    expect(DOC_FORMAT_POLICY[DocType.MODULE_DOCS]).toEqual([DocFormat.MARKDOWN, DocFormat.HTML]);
    expect(DOC_FORMAT_POLICY[DocType.ONBOARDING_GUIDE]).toEqual([
      DocFormat.MARKDOWN,
      DocFormat.HTML,
    ]);
  });

  it('should cover every DocType with an entry', () => {
    expect(Object.keys(DOC_FORMAT_POLICY).sort()).toEqual(Object.values(DocType).sort());
  });
});

describe('resolveFormats', () => {
  it('should return the formats for a given doc type', () => {
    expect(resolveFormats(DocType.API_REFERENCE)).toEqual([
      DocFormat.MARKDOWN,
      DocFormat.HTML,
      DocFormat.OPENAPI,
      DocFormat.JSON,
    ]);
  });

  it('should return a fresh array per call (no shared mutation)', () => {
    const a = resolveFormats(DocType.README);
    const b = resolveFormats(DocType.README);
    expect(a).not.toBe(b);
  });
});
