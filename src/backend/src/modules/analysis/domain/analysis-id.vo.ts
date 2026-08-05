import { Identifier } from '../../../shared/domain/identifier';
import { randomUUID } from 'crypto';

export class AnalysisId extends Identifier<string> {
  static create(): AnalysisId {
    return new AnalysisId(randomUUID());
  }

  static from(value: string): AnalysisId {
    return new AnalysisId(value);
  }
}
