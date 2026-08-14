import { DocArtifact, DocArtifactId } from '@/modules/documentation/domain/doc-artifact.entity';
import { DocType } from '@/modules/documentation/domain/doc-type.enum';
import { DocFormat } from '@/modules/documentation/domain/doc-format.enum';
import { DocBuildStatus } from '@/modules/documentation/domain/doc-build-status.enum';

/**
 * Task 1.5 (PR1) — DocArtifact aggregate root. Fields per documentation-storage
 * R4: id, repositoryId, commitSha, docType, format, minioKey, sizeBytes,
 * generatedAt, templateVersion, aiModelVersion (nullable) + status.
 */
describe('DocArtifactId', () => {
  it('should create a UUID identifier', () => {
    const id = DocArtifactId.create();
    expect(id.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should rebuild an identifier from a stored value', () => {
    const from = DocArtifactId.from('doc-123');
    expect(from.value).toBe('doc-123');
    expect(from.equals(DocArtifactId.from('doc-123'))).toBe(true);
  });
});

describe('DocArtifact', () => {
  it('should create a building artifact with all storage R4 metadata', () => {
    const artifact = DocArtifact.create(
      'repo-42',
      'abc123',
      DocType.README,
      DocFormat.MARKDOWN,
      'v1',
    );

    expect(artifact.repositoryId).toBe('repo-42');
    expect(artifact.commitSha).toBe('abc123');
    expect(artifact.docType).toBe(DocType.README);
    expect(artifact.format).toBe(DocFormat.MARKDOWN);
    expect(artifact.templateVersion).toBe('v1');
    expect(artifact.status).toBe(DocBuildStatus.BUILDING);
    expect(artifact.aiModelVersion).toBeNull();
    expect(artifact.id.value).toMatch(/^[0-9a-f]{8}-/);
  });

  it('should transition to completed with sizeBytes, minioKey and aiModelVersion', () => {
    const artifact = DocArtifact.create(
      'repo-42',
      'abc123',
      DocType.README,
      DocFormat.MARKDOWN,
      'v1',
    );
    artifact.complete('org-1/repo-42/abc123/readme.md', 15360, 'deepseek-v4');

    expect(artifact.status).toBe(DocBuildStatus.COMPLETED);
    expect(artifact.minioKey).toBe('org-1/repo-42/abc123/readme.md');
    expect(artifact.sizeBytes).toBe(15360);
    expect(artifact.aiModelVersion).toBe('deepseek-v4');
    expect(artifact.generatedAt).toBeInstanceOf(Date);
  });

  it('should not complete from a non-building status', () => {
    const artifact = DocArtifact.reconstitute(
      DocArtifactId.from('doc-123'),
      'repo-42',
      'abc123',
      DocType.README,
      DocFormat.MARKDOWN,
      'org-1/repo-42/abc123/readme.md',
      1024,
      new Date('2026-01-01T00:00:00Z'),
      'v1',
      null,
      DocBuildStatus.COMPLETED,
    );

    expect(() => artifact.complete('org-1/other.md', 1, null)).toThrow(
      /can only complete from BUILDING/,
    );
  });

  it('should transition to failed', () => {
    const artifact = DocArtifact.create('repo-42', 'abc123', DocType.README, DocFormat.HTML, 'v1');
    artifact.fail();
    expect(artifact.status).toBe(DocBuildStatus.FAILED);
  });

  it('should transition to skipped for idempotent skips', () => {
    const artifact = DocArtifact.create(
      'repo-42',
      'abc123',
      DocType.README,
      DocFormat.MARKDOWN,
      'v1',
    );
    artifact.skip();
    expect(artifact.status).toBe(DocBuildStatus.SKIPPED);
  });
});
