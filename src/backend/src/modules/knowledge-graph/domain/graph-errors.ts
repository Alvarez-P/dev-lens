import { DomainError } from '../../../shared/domain/domain-error';

export class GraphValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'GRAPH_VALIDATION_ERROR', 422);
  }
}

export class GraphNotFoundError extends DomainError {
  constructor(repositoryId: string) {
    super(`Knowledge graph not found for repository "${repositoryId}"`, 'GRAPH_NOT_FOUND', 404);
  }
}

export class DuplicateGraphSnapshotError extends DomainError {
  constructor(analysisId: string) {
    super(
      `Graph snapshot already exists for analysis "${analysisId}"`,
      'DUPLICATE_GRAPH_SNAPSHOT',
      409,
    );
  }
}

export class InvalidNodeTypeError extends DomainError {
  constructor(type: string) {
    super(`Unknown node type "${type}"`, 'INVALID_NODE_TYPE', 422);
  }
}

export class DuplicateNodeError extends DomainError {
  constructor(fqn: string) {
    super(`Graph node with fqn "${fqn}" already exists in this version`, 'DUPLICATE_NODE', 409);
  }
}

export class DanglingEdgeError extends DomainError {
  constructor(sourceFqn: string, targetFqn: string) {
    super(
      `Graph edge references missing node: "${sourceFqn}" -> "${targetFqn}"`,
      'DANGLING_EDGE',
      422,
    );
  }
}

export class GraphIntegrityError extends DomainError {
  constructor(message: string) {
    super(message, 'GRAPH_INTEGRITY', 422);
  }
}
