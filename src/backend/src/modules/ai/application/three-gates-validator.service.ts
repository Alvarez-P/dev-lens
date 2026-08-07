import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateNested,
  validateSync,
} from 'class-validator';
import { IrProject } from '../../analysis/domain/ir-nodes';
import { AIDidNotMeetSchemaError } from '../domain/ai-errors';
import { AIClassifiedRole, AIDtoField, FailedUnit } from '../domain/ai-enrichment.entity';

/** Accepted lifecycle-stage kinds parsed from `kind:name` entries (REQ-EP-007). */
export const LIFECYCLE_KINDS = ['guard', 'pipe', 'interceptor', 'middleware'] as const;

/** Roles the LLM may emit (aligns with classify-lifecycle v1 instructions). */
export const AI_ROLE_ENUM = [
  'controller',
  'service',
  'repository',
  'guard',
  'pipe',
  'interceptor',
  'middleware',
  'module',
  'entity',
  'dto',
  'exception-filter',
  'gateway',
  'event-handler',
  'message-handler',
  'other',
] as const;

/** Gate 3 threshold: confidence >= 0.7 accepts, below downgrades (REQ-EP-004). */
export const CONFIDENCE_THRESHOLD = 0.7;

class DtoFieldDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  type!: string;

  @IsBoolean()
  optional!: boolean;
}

class ClassRoleDto {
  @IsString()
  @IsNotEmpty()
  fqn!: string;

  @IsIn(AI_ROLE_ENUM)
  role!: string;

  @IsArray()
  @IsString({ each: true })
  lifecycle!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DtoFieldDto)
  dtoFields!: AIDtoField[];

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;

  @IsString()
  @IsNotEmpty()
  sourceFile!: string;
}

class EnrichmentDto {
  @IsString()
  @IsNotEmpty()
  framework!: string;

  @IsString()
  @IsNotEmpty()
  architecture!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassRoleDto)
  classes!: ClassRoleDto[];
}

export interface ValidatedEnrichment {
  framework: string;
  architecture: string;
  confidence: number;
  classes: AIClassifiedRole[];
  failedUnits: FailedUnit[];
  warnings: string[];
}

/**
 * Three-gate output validation (REQ-EP-004).
 *
 * 1. Schema — class-validator DTO with whitelist + forbidNonWhitelisted.
 *    Failure throws AIDidNotMeetSchemaError so the worker can retry once
 *    with the validation errors appended to the prompt.
 * 2. Referential integrity — every class FQN must resolve against the IR;
 *    unresolvable entries are dropped with a warning (never fail the batch).
 * 3. Confidence — items below 0.7 are downgraded to role `UNKNOWN` and
 *    reported as `low-confidence`, counted in failedUnits.
 */
@Injectable()
export class ThreeGatesValidator {
  private readonly logger = new Logger(ThreeGatesValidator.name);

  validate(json: unknown, ir: IrProject): ValidatedEnrichment {
    const dto = this.gate1Schema(json);

    const knownFqns = this.collectIrFqns(ir);

    const classes: AIClassifiedRole[] = [];
    const failedUnits: FailedUnit[] = [];
    const warnings: string[] = [];

    for (const candidate of dto.classes) {
      const role: AIClassifiedRole = {
        fqn: candidate.fqn,
        role: candidate.role,
        lifecycle: candidate.lifecycle,
        dtoFields: candidate.dtoFields,
        confidence: candidate.confidence,
        sourceFile: candidate.sourceFile,
      };

      // Gate 2 — referential integrity.
      if (!knownFqns.has(candidate.fqn)) {
        const message = `Referential check: FQN '${candidate.fqn}' not found in IR — dropped`;
        warnings.push(message);
        this.logger.warn(message);
        failedUnits.push({ fqn: candidate.fqn, reason: 'not_found_in_ir' });
        continue;
      }

      // Gate 3 — confidence threshold.
      if (role.confidence < CONFIDENCE_THRESHOLD) {
        role.role = 'UNKNOWN';
        role.status = 'low-confidence';
        failedUnits.push({ fqn: candidate.fqn, reason: 'low-confidence' });
      } else {
        role.status = 'accepted';
      }

      classes.push(role);
    }

    return {
      framework: dto.framework,
      architecture: dto.architecture,
      confidence: dto.confidence,
      classes,
      failedUnits,
      warnings,
    };
  }

  private gate1Schema(json: unknown): EnrichmentDto {
    const instance = plainToInstance(EnrichmentDto, json);
    const errors = validateSync(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    });

    if (errors.length > 0) {
      const details = errors.map((error) => this.describeError(error)).join('; ');
      throw new AIDidNotMeetSchemaError(
        'unknown',
        'unknown',
        `Enrichment response failed schema validation: ${details}`,
      );
    }

    return instance;
  }

  private describeError(error: { property: string; constraints?: Record<string, string> }): string {
    if (error.constraints !== undefined) {
      return Object.values(error.constraints).join(', ');
    }

    return `invalid value for "${error.property}"`;
  }

  private collectIrFqns(ir: IrProject): Set<string> {
    const fqns = new Set<string>([ir.fqn]);

    for (const pkg of ir.packages) {
      fqns.add(pkg.fqn);

      for (const mod of pkg.modules) {
        fqns.add(mod.fqn);

        for (const cls of mod.classes) {
          fqns.add(cls.fqn);
          for (const method of cls.methods) {
            fqns.add(method.fqn);
          }
          for (const endpoint of cls.endpoints) {
            fqns.add(endpoint.fqn);
          }
        }

        for (const iface of mod.interfaces) {
          fqns.add(iface.fqn);
        }

        for (const fn of mod.functions) {
          fqns.add(fn.fqn);
        }
      }
    }

    return fqns;
  }
}

/** Parses a lifecycle entry like `guard:JwtGuard` into kind + name. */
export function parseLifecycleEntry(
  entry: string,
): { kind: (typeof LIFECYCLE_KINDS)[number]; name: string } | null {
  const separatorIndex = entry.indexOf(':');

  if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
    return null;
  }

  const kind = entry.slice(0, separatorIndex) as (typeof LIFECYCLE_KINDS)[number];
  const name = entry.slice(separatorIndex + 1);

  if (!LIFECYCLE_KINDS.includes(kind) || !name.trim()) {
    return null;
  }

  return { kind, name };
}
