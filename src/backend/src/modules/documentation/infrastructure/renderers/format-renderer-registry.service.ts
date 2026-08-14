import { Inject, Injectable } from '@nestjs/common';
import { FORMAT_RENDERER } from '../../documentation.tokens';
import { DocFormat } from '../../domain/doc-format.enum';
import { IDocFormatRenderer } from './renderer.interface';

/**
 * Token-map renderer registry (documentation-formats R1) — the resolver for
 * the FORMAT_RENDERER token. Injects the renderer array (assembled by a factory
 * provider) and indexes it by `format` key, mirroring the AI_PROVIDER_REGISTRY
 * pattern. A new renderer needs only be registered with the FORMAT_RENDERER
 * token in the factory — zero changes to this registry.
 */
@Injectable()
export class FormatRendererRegistry {
  private readonly byFormat: Map<DocFormat, IDocFormatRenderer>;

  constructor(@Inject(FORMAT_RENDERER) renderers: IDocFormatRenderer[]) {
    this.byFormat = new Map(renderers.map((renderer) => [renderer.format, renderer]));
  }

  resolve(format: DocFormat): IDocFormatRenderer {
    const renderer = this.byFormat.get(format);
    if (!renderer) {
      throw new Error(`No renderer registered for format: ${format}`);
    }
    return renderer;
  }

  get formats(): DocFormat[] {
    return [...this.byFormat.keys()];
  }
}
