import { Test, type TestingModule } from '@nestjs/testing';
import type { Provider } from '@nestjs/common';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import { IDocFormatRenderer } from '@/modules/documentation/infrastructure/renderers/renderer.interface';
import { FORMAT_RENDERER } from '@/modules/documentation/documentation.tokens';
import { FormatRendererRegistry } from '@/modules/documentation/infrastructure/renderers/format-renderer-registry.service';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { SectionFormat } from '@/modules/documentation/domain/doc-template';
import { GeneratedDocument } from '@/modules/documentation/domain/doc-document';

function makeDoc(): GeneratedDocument {
  return {
    docType: DocType.README,
    templateVersion: '1',
    title: 'README',
    repositoryId: 'repo-42',
    commitSha: 'abc123',
    generatedAt: '2026-01-01T00:00:00.000Z',
    sections: [],
  };
}

class FakeMarkdownRenderer implements IDocFormatRenderer {
  readonly format = DocFormat.MARKDOWN;
  render = jest.fn(() => ({
    format: DocFormat.MARKDOWN,
    contentType: 'text/markdown',
    ext: 'md',
    buffer: Buffer.from('# README'),
  }));
}

class FakeJsonRenderer implements IDocFormatRenderer {
  readonly format = DocFormat.JSON;
  render = jest.fn(() => ({
    format: DocFormat.JSON,
    contentType: 'application/json',
    ext: 'json',
    buffer: Buffer.from('{}'),
  }));
}

/**
 * Task 1.7 (PR1) — renderer contract + FORMAT_RENDERER token-map registry
 * (documentation-formats R1). A new renderer must be resolvable with zero
 * changes to existing renderers or the registry.
 *
 * DEVIATION NOTE: the design/spec chose `{ provide: FORMAT_RENDERER, useClass,
 * multi: true }`, but NestJS 10.4.15 does NOT support multi-providers (verified
 * at runtime: the second provider overwrites the first; `multi` appears nowhere
 * in @nestjs/core). The registry therefore consumes an array assembled by a
 * factory provider (the AI_PROVIDER_REGISTRY pattern, ai.module.ts:134).
 */
const buildModule = async (...renderers: Provider[]): Promise<TestingModule> =>
  Test.createTestingModule({
    providers: [
      ...renderers,
      FormatRendererRegistry,
      {
        provide: FORMAT_RENDERER,
        useFactory: (...instances: IDocFormatRenderer[]): IDocFormatRenderer[] => instances,
        inject: renderers.map((r) => (r as { provide?: unknown }).provide as never),
      },
    ],
  }).compile();
describe('renderer.interface — IDocFormatRenderer contract', () => {
  it('should expose a DocFormat key and a render(doc) → RenderedArtifact method', () => {
    const renderer: IDocFormatRenderer = new FakeMarkdownRenderer();
    expect(renderer.format).toBe(DocFormat.MARKDOWN);

    const artifact = renderer.render(makeDoc());
    expect(artifact.format).toBe(DocFormat.MARKDOWN);
    expect(artifact.contentType).toBe('text/markdown');
    expect(artifact.ext).toBe('md');
    expect(artifact.buffer).toBeInstanceOf(Buffer);
    expect(artifact.buffer.toString()).toBe('# README');
  });
});

describe('FormatRendererRegistry — token-map registry (R1)', () => {
  it('should resolve renderers by format key from the injected renderer array', async () => {
    const moduleRef = await buildModule(
      { provide: FakeMarkdownRenderer, useClass: FakeMarkdownRenderer },
      { provide: FakeJsonRenderer, useClass: FakeJsonRenderer },
    );

    const registry = moduleRef.get(FormatRendererRegistry);
    const resolved = registry.resolve(DocFormat.MARKDOWN);

    expect(resolved.format).toBe(DocFormat.MARKDOWN);
    expect(registry.resolve(DocFormat.JSON)).toBeInstanceOf(FakeJsonRenderer);
  });

  it('should expose the set of registered formats', async () => {
    const moduleRef = await buildModule(
      { provide: FakeMarkdownRenderer, useClass: FakeMarkdownRenderer },
      { provide: FakeJsonRenderer, useClass: FakeJsonRenderer },
    );

    const registry = moduleRef.get(FormatRendererRegistry);
    expect(registry.formats).toEqual(expect.arrayContaining([DocFormat.MARKDOWN, DocFormat.JSON]));
  });

  it('should throw for an unregistered format', async () => {
    const moduleRef = await buildModule({
      provide: FakeMarkdownRenderer,
      useClass: FakeMarkdownRenderer,
    });

    const registry = moduleRef.get(FormatRendererRegistry);
    expect(() => registry.resolve(DocFormat.OPENAPI)).toThrow(/No renderer registered for format/);
  });

  it('should resolve a newly added renderer without modifying the registry (R1 scenario)', async () => {
    // First slice: only markdown registered.
    const moduleRef = await buildModule({
      provide: FakeMarkdownRenderer,
      useClass: FakeMarkdownRenderer,
    });

    // A later slice adds a PDF renderer to the factory array — registry code
    // and existing renderers remain untouched.
    const pdfRenderer = {
      format: 'pdf' as DocFormat,
      render: jest.fn(),
    } satisfies IDocFormatRenderer;

    const moduleRef2 = await buildModule(
      { provide: FakeMarkdownRenderer, useClass: FakeMarkdownRenderer },
      { provide: 'PDF_RENDERER', useValue: pdfRenderer },
    );

    const registry = moduleRef2.get(FormatRendererRegistry);
    expect(registry.resolve('pdf' as DocFormat).format).toBe('pdf');
    // Existing renderers still resolve — zero changes to registry code.
    expect(registry.resolve(DocFormat.MARKDOWN)).toBeInstanceOf(FakeMarkdownRenderer);
    // Original module unaffected.
    expect(moduleRef.get(FormatRendererRegistry).formats).toEqual([DocFormat.MARKDOWN]);
  });
});

describe('SectionFormat contract used by renderers', () => {
  it('should type document sections with the section-level formats', () => {
    expect(SectionFormat.TABLE).toBe('table');
    expect(SectionFormat.MERMAID_CLASS_DIAGRAM).toBe('mermaid-class-diagram');
    expect(SectionFormat.PLANTUML).toBe('plantuml');
  });
});
