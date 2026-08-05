import { randomUUID } from 'crypto';
import { ValueObject } from '../../../shared/domain/value-object';
import { EdgeType } from './edge-type.enum';

export interface GraphEdgeJson {
  id: string;
  type: EdgeType;
  sourceNodeId: string;
  targetNodeId: string;
  properties: Record<string, unknown>;
  version: number;
}

export class GraphEdge extends ValueObject {
  private constructor(
    public readonly id: string,
    public readonly type: EdgeType,
    public readonly sourceNodeId: string,
    public readonly targetNodeId: string,
    public readonly properties: Readonly<Record<string, unknown>>,
    public readonly version: number,
  ) {
    super();
  }

  static create(
    type: EdgeType,
    sourceNodeId: string,
    targetNodeId: string,
    properties: Record<string, unknown> | undefined,
    version: number,
  ): GraphEdge {
    this.validateType(type);
    this.validateNodeId(sourceNodeId, 'sourceNodeId');
    this.validateNodeId(targetNodeId, 'targetNodeId');
    this.validateDistinct(sourceNodeId, targetNodeId);
    this.validateVersion(version);

    return new GraphEdge(
      randomUUID(),
      type,
      sourceNodeId.trim(),
      targetNodeId.trim(),
      Object.freeze({ ...(properties ?? {}) }),
      version,
    );
  }

  static reconstitute(
    id: string,
    type: EdgeType,
    sourceNodeId: string,
    targetNodeId: string,
    properties: Record<string, unknown> | undefined,
    version: number,
  ): GraphEdge {
    return new GraphEdge(
      id,
      type,
      sourceNodeId,
      targetNodeId,
      Object.freeze({ ...(properties ?? {}) }),
      version,
    );
  }

  protected getEqualityComponents(): unknown[] {
    return [
      this.id,
      this.type,
      this.sourceNodeId,
      this.targetNodeId,
      this.properties,
      this.version,
    ];
  }

  toJSON(): GraphEdgeJson {
    return {
      id: this.id,
      type: this.type,
      sourceNodeId: this.sourceNodeId,
      targetNodeId: this.targetNodeId,
      properties: { ...this.properties },
      version: this.version,
    };
  }

  private static validateType(type: EdgeType): void {
    if (!Object.values(EdgeType).includes(type)) {
      throw new Error(`Unknown edge type "${type}"`);
    }
  }

  private static validateNodeId(nodeId: string, field: string): void {
    if (!nodeId.trim()) {
      throw new Error(`Edge ${field} must not be empty`);
    }
  }

  private static validateDistinct(sourceNodeId: string, targetNodeId: string): void {
    if (sourceNodeId.trim() === targetNodeId.trim()) {
      throw new Error('Edge sourceNodeId and targetNodeId must differ');
    }
  }

  private static validateVersion(version: number): void {
    if (!Number.isInteger(version) || version < 1) {
      throw new Error('Edge version must be a positive integer');
    }
  }
}
