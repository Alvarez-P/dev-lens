import { randomUUID } from 'crypto';
import { ValueObject } from '../../../shared/domain/value-object';
import { NodeType } from './node-type.enum';
import { InvalidNodeTypeError } from './graph-errors';

const FQN_PATTERN = /^[^#:\s]+(?::[^#:\s]+)*(?:#[^#:\s]+)?$/;

export interface GraphNodeJson {
  id: string;
  type: NodeType;
  label: string;
  fqn: string;
  properties: Record<string, unknown>;
  repoId: string;
  version: number;
  deprecatedAt: string | null;
}

export class GraphNode extends ValueObject {
  private constructor(
    public readonly id: string,
    public readonly type: NodeType,
    public readonly label: string,
    public readonly fqn: string,
    public readonly properties: Readonly<Record<string, unknown>>,
    public readonly repoId: string,
    public readonly version: number,
    public readonly deprecatedAt: Date | null,
  ) {
    super();
  }

  static create(
    type: NodeType,
    label: string,
    fqn: string,
    properties: Record<string, unknown> | undefined,
    repoId: string,
    version: number,
  ): GraphNode {
    this.validateType(type);
    this.validateLabel(label);
    this.validateFqn(fqn);
    this.validateRepoId(repoId);
    this.validateVersion(version);

    return new GraphNode(
      randomUUID(),
      type,
      label.trim(),
      fqn.trim(),
      Object.freeze({ ...(properties ?? {}) }),
      repoId.trim(),
      version,
      null,
    );
  }

  static reconstitute(
    id: string,
    type: NodeType,
    label: string,
    fqn: string,
    properties: Record<string, unknown> | undefined,
    repoId: string,
    version: number,
    deprecatedAt: Date | null,
  ): GraphNode {
    return new GraphNode(
      id,
      type,
      label,
      fqn,
      Object.freeze({ ...(properties ?? {}) }),
      repoId,
      version,
      deprecatedAt,
    );
  }

  protected getEqualityComponents(): unknown[] {
    return [
      this.id,
      this.type,
      this.label,
      this.fqn,
      this.properties,
      this.repoId,
      this.version,
      this.deprecatedAt,
    ];
  }

  toJSON(): GraphNodeJson {
    return {
      id: this.id,
      type: this.type,
      label: this.label,
      fqn: this.fqn,
      properties: { ...this.properties },
      repoId: this.repoId,
      version: this.version,
      deprecatedAt: this.deprecatedAt?.toISOString() ?? null,
    };
  }

  private static validateType(type: NodeType): void {
    if (!Object.values(NodeType).includes(type)) {
      throw new InvalidNodeTypeError(type);
    }
  }

  private static validateLabel(label: string): void {
    if (!label.trim()) {
      throw new Error('Node label must not be empty');
    }
  }

  private static validateFqn(fqn: string): void {
    const trimmed = fqn.trim();

    if (!trimmed) {
      throw new Error('Node fqn must not be empty');
    }

    if (!FQN_PATTERN.test(trimmed)) {
      throw new Error('Invalid fqn format');
    }
  }

  private static validateRepoId(repoId: string): void {
    if (!repoId.trim()) {
      throw new Error('Node repoId must not be empty');
    }
  }

  private static validateVersion(version: number): void {
    if (!Number.isInteger(version) || version < 1) {
      throw new Error('Node version must be a positive integer');
    }
  }
}
