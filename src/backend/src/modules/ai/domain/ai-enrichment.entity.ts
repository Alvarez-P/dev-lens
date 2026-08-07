import { randomUUID } from 'crypto';
import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { Identifier } from '../../../shared/domain/identifier';

/** Per-DTO field metadata extracted by the LLM (REQ-EP-005). */
export interface AIDtoField {
  name: string;
  type: string;
  optional: boolean;
}

/** Per-class classification produced by the LLM (REQ-EP-005). */
export interface AIClassifiedRole {
  /** FQN matching IrNode.fqn. */
  fqn: string;
  /** e.g. 'controller', 'service', 'repository', 'guard', 'pipe', 'interceptor'. */
  role: string;
  /** e.g. ['guard:JwtGuard', 'pipe:ValidationPipe', 'handler']. */
  lifecycle: string[];
  /** Empty if not a DTO class. */
  dtoFields: AIDtoField[];
  /** 0–1 confidence. */
  confidence: number;
  /** From IrNode.filePath. */
  sourceFile: string;
}

export interface IrEnrichmentProps {
  analysisId: string;
  repositoryId: string;
  /** Cache key — matches analysis manifest. */
  manifestSha256: string;
  framework: string;
  architecture: string;
  /** 0–1 overall framework/architecture confidence. */
  confidence: number;
  classes: AIClassifiedRole[];
}

export interface IrEnrichmentJson extends IrEnrichmentProps {
  id: string;
  completedAt: string;
}

export class IrEnrichmentId extends Identifier<string> {
  static create(): IrEnrichmentId {
    return new IrEnrichmentId(randomUUID());
  }

  static from(value: string): IrEnrichmentId {
    return new IrEnrichmentId(value);
  }
}

/**
 * AI enrichment artifact — immutable after creation, no partial updates
 * (REQ-EP-005).
 */
export class IrEnrichment extends AggregateRoot<IrEnrichmentId> {
  private constructor(
    id: IrEnrichmentId,
    public readonly analysisId: string,
    public readonly repositoryId: string,
    public readonly manifestSha256: string,
    public readonly framework: string,
    public readonly architecture: string,
    public readonly confidence: number,
    public readonly classes: readonly AIClassifiedRole[],
    public readonly completedAt: Date,
  ) {
    super(id);
  }

  static create(props: IrEnrichmentProps): IrEnrichment {
    return new IrEnrichment(
      IrEnrichmentId.create(),
      props.analysisId,
      props.repositoryId,
      props.manifestSha256,
      props.framework,
      props.architecture,
      props.confidence,
      Object.freeze([...props.classes]),
      new Date(),
    );
  }

  static reconstitute(
    id: IrEnrichmentId,
    analysisId: string,
    repositoryId: string,
    manifestSha256: string,
    framework: string,
    architecture: string,
    confidence: number,
    classes: AIClassifiedRole[],
    completedAt: Date,
  ): IrEnrichment {
    return new IrEnrichment(
      id,
      analysisId,
      repositoryId,
      manifestSha256,
      framework,
      architecture,
      confidence,
      Object.freeze([...classes]),
      completedAt,
    );
  }

  toJSON(): IrEnrichmentJson {
    return {
      id: this.id.value,
      analysisId: this.analysisId,
      repositoryId: this.repositoryId,
      manifestSha256: this.manifestSha256,
      framework: this.framework,
      architecture: this.architecture,
      confidence: this.confidence,
      classes: [...this.classes],
      completedAt: this.completedAt.toISOString(),
    };
  }
}
