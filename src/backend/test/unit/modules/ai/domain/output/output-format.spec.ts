import 'reflect-metadata';
import { createOutputFormat } from '@/modules/ai/domain/output/output-format';
import { LifecycleEnrichmentDto } from '@/modules/ai/domain/output/lifecycle-enrichment.dto';

/**
 * Task 1.2 (PR2) — OutputFormat per spec R3: text, markdown (optional
 * frontmatter), and json (validated via a class-validator DTO). JSON formats
 * SHALL specify the DTO class for post-generation validation.
 */
describe('OutputFormat (spec R3)', () => {
  it('should support text, markdown and json formats', () => {
    const text = createOutputFormat({ type: 'text' });
    const markdown = createOutputFormat({ type: 'markdown', frontmatter: true });
    const json = createOutputFormat({ type: 'json', dto: LifecycleEnrichmentDto });

    expect(text.type).toBe('text');
    expect(markdown.type).toBe('markdown');
    expect(markdown.frontmatter).toBe(true);
    expect(json.type).toBe('json');
    expect(json.dto).toBe(LifecycleEnrichmentDto);
  });

  it('should leave frontmatter unset for plain markdown', () => {
    const markdown = createOutputFormat({ type: 'markdown' });

    expect(markdown.frontmatter).toBeUndefined();
  });

  it('should reject a json format without a DTO class', () => {
    expect(() => createOutputFormat({ type: 'json' })).toThrow(/dto/i);
  });
});
