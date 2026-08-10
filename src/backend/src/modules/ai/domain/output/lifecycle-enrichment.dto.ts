import { Type } from 'class-transformer';
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
} from 'class-validator';
import { AIDtoField } from '../ai-enrichment.entity';

/**
 * Roles the lifecycle-enrichment LLM output may emit. Mirrors the role set
 * used by the enrichment pipeline (three-gates-validator). Domain-owned so
 * output DTOs never depend on the application layer.
 */
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

export class DtoFieldDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  type!: string;

  @IsBoolean()
  optional!: boolean;
}

export class ClassRoleDto {
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

/**
 * JSON output shape of the lifecycle-enrichment capability (spec R3). Used as
 * the `outputFormat.dto` of the capability so generated responses are
 * validated post-hoc with class-validator; failures surface as
 * `AIDidNotMeetSchemaError` in the pipeline.
 */
export class LifecycleEnrichmentDto {
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
