import {
  DocumentationStartedEvent,
  DocumentationProgressEvent,
  DocumentationGeneratedEvent,
  DocumentationFailedEvent,
} from '@/modules/documentation/domain/documentation-events';

/**
 * Task 1.5 (PR1) — progress/reporting domain events (documentation-generation
 * R5): started (job begins), progress (stage + percentage), completed (doc
 * type list), failed (stage + error). Mirrors knowledge-graph graph-events.ts.
 */
describe('DocumentationStartedEvent', () => {
  it('should carry repositoryId, jobId, docTypes and eventType', () => {
    const event = new DocumentationStartedEvent(
      'repo-42',
      'job-1',
      ['readme', 'api-reference'],
      'abc123',
    );

    expect(event.eventType).toBe('documentation.started');
    expect(event.repositoryId).toBe('repo-42');
    expect(event.jobId).toBe('job-1');
    expect(event.docTypes).toEqual(['readme', 'api-reference']);
    expect(event.commitSha).toBe('abc123');
    expect(event.occurredOn).toBeInstanceOf(Date);
    expect(event.timestamp).toBeInstanceOf(Date);
  });
});

describe('DocumentationProgressEvent', () => {
  it('should carry the stage name and a progress percentage', () => {
    const event = new DocumentationProgressEvent('repo-42', 'job-1', 'render', 60);

    expect(event.eventType).toBe('documentation.progress');
    expect(event.stage).toBe('render');
    expect(event.progress).toBe(60);
  });
});

describe('DocumentationGeneratedEvent', () => {
  it('should carry the generated doc type list', () => {
    const event = new DocumentationGeneratedEvent('repo-42', 'job-1', ['readme'], 'abc123');

    expect(event.eventType).toBe('documentation.completed');
    expect(event.docTypes).toEqual(['readme']);
    expect(event.commitSha).toBe('abc123');
  });
});

describe('DocumentationFailedEvent', () => {
  it('should carry the failing stage and error message', () => {
    const event = new DocumentationFailedEvent(
      'repo-42',
      'job-1',
      'ai-enrichment',
      'provider unavailable',
    );

    expect(event.eventType).toBe('documentation.failed');
    expect(event.stage).toBe('ai-enrichment');
    expect(event.error).toBe('provider unavailable');
  });
});
