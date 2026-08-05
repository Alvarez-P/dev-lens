import {
  GraphValidationError,
  GraphNotFoundError,
  DuplicateGraphSnapshotError,
  InvalidNodeTypeError,
  DuplicateNodeError,
  DanglingEdgeError,
  GraphIntegrityError,
} from '@/modules/knowledge-graph/domain/graph-errors';

describe('graph errors', () => {
  it('GraphValidationError should carry a code and message', () => {
    const error = new GraphValidationError('Graph is invalid');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('GraphValidationError');
    expect(error.code).toBe('GRAPH_VALIDATION_ERROR');
    expect(error.message).toBe('Graph is invalid');
  });

  it('GraphNotFoundError should carry the repository identifier', () => {
    const error = new GraphNotFoundError('repo-1');

    expect(error.code).toBe('GRAPH_NOT_FOUND');
    expect(error.message).toContain('repo-1');
  });

  it('DuplicateGraphSnapshotError should carry the analysis identifier', () => {
    const error = new DuplicateGraphSnapshotError('analysis-1');

    expect(error.code).toBe('DUPLICATE_GRAPH_SNAPSHOT');
    expect(error.message).toContain('analysis-1');
  });

  it('InvalidNodeTypeError should carry the offending type', () => {
    const error = new InvalidNodeTypeError('Galaxy');

    expect(error.code).toBe('INVALID_NODE_TYPE');
    expect(error.message).toContain('Galaxy');
  });

  it('DuplicateNodeError should carry the conflicting fqn', () => {
    const error = new DuplicateNodeError('acme:core:src/auth#AuthService');

    expect(error.code).toBe('DUPLICATE_NODE');
    expect(error.message).toContain('acme:core:src/auth#AuthService');
  });

  it('DanglingEdgeError should carry the unresolved endpoints', () => {
    const error = new DanglingEdgeError('acme:core:src/auth#AuthService', 'missing:Target');

    expect(error.code).toBe('DANGLING_EDGE');
    expect(error.message).toContain('acme:core:src/auth#AuthService');
    expect(error.message).toContain('missing:Target');
  });

  it('GraphIntegrityError should carry a code and message', () => {
    const error = new GraphIntegrityError('Edge references missing node');

    expect(error.code).toBe('GRAPH_INTEGRITY');
    expect(error.message).toBe('Edge references missing node');
  });
});
