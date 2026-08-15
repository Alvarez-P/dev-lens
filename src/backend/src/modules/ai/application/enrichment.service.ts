import { Inject, Injectable, Logger } from '@nestjs/common';
import { Analysis, AnalysisId, FrameworkCandidate } from '../../analysis/domain';
import { IrProject } from '../../analysis/domain/ir-nodes';
import { AnalysisRepository } from '../../analysis/infrastructure/persistence/repositories/analysis.repository';
import { FileManifestService } from '../../analysis/application/file-manifest.service';
import { DomainEventDispatcher } from '../../../shared/domain/domain-event-dispatcher';
import { EnrichmentRepository } from '../infrastructure/persistence/repositories/enrichment.repository';
import { ContextAssembler } from './context-assembler.service';
import { PromptBuilder } from './prompt-builder.service';
import { ProviderSelectorService } from './provider-selector.service';
import { ThreeGatesValidator, ValidatedEnrichment } from './three-gates-validator.service';
import { IrEnrichment } from '../domain/ai-enrichment.entity';
import {
  EnrichmentStartedEvent,
  EnrichmentCompletedEvent,
  EnrichmentSkippedEvent,
  EnrichmentFailedEvent,
} from '../domain/ai-events';
import { AIDidNotMeetSchemaError, BaseAIError } from '../domain/ai-errors';

/** Capability id registered under `ai.capabilities/` (classify-lifecycle v1). */
export const CLASSIFY_LIFECYCLE_CAPABILITY = 'classify-lifecycle';

export interface EnrichmentJobData {
  analysisId: string;
  repositoryId: string;
  snapshotId: string;
  correlationId: string;
}

export interface EnrichmentRunOptions {
  /** True when this is the last BullMQ attempt — only then is failed emitted. */
  finalAttempt?: boolean;
}

const SCHEMA_RETRY_FEEDBACK =
  'Your previous response failed validation: %s. Respond again with a corrected JSON object.';

/**
 * Orchestrates the 7-stage enrichment pipeline (REQ-EP-003):
 *
 * 1. Load Analysis (AnalysisRepository) → IR + manifest
 * 2. Idempotency check (EnrichmentRepository) — skip when manifest unchanged
 * 3. Assemble context (ContextAssembler) → CodeSketch[]
 * 4. Build prompt (PromptBuilder) — versioned templates + framework config
 * 5. Call provider (ProviderSelector + AIProvider.enrich) → raw JSON
 * 6. Validate output (ThreeGatesValidator) — schema retry once, referential
 *    drop, confidence downgrade
 * 7. Persist (EnrichmentRepository) + emit enrichment.completed
 *
 * Failures degrade gracefully: a provider outage or exhausted schema retry
 * aborts the pipeline (deterministic classification remains), while per-unit
 * validation failures (gates 2/3) are recorded in `failedUnits` and the
 * remaining units still persist — REQ-EP-009.
 */
@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    private readonly analysisRepository: AnalysisRepository,
    private readonly enrichmentRepository: EnrichmentRepository,
    private readonly contextAssembler: ContextAssembler,
    private readonly promptBuilder: PromptBuilder,
    private readonly providerSelector: ProviderSelectorService,
    private readonly validator: ThreeGatesValidator,
    @Inject('DOMAIN_EVENT_DISPATCHER')
    private readonly eventDispatcher: DomainEventDispatcher,
  ) {}

  async run(job: EnrichmentJobData, options: EnrichmentRunOptions = {}): Promise<void> {
    const { analysisId, repositoryId, snapshotId, correlationId } = job;

    await this.eventDispatcher.dispatch(
      new EnrichmentStartedEvent(analysisId, repositoryId, snapshotId, correlationId),
    );

    try {
      // Stage 1: load analysis → IR + manifest.
      const analysis = await this.analysisRepository.findById(AnalysisId.from(analysisId));

      if (analysis === null || analysis.ir === null) {
        throw new Error(`Analysis "${analysisId}" not found or has no intermediate representation`);
      }

      const manifestSha256 = FileManifestService.computeManifestSha256(analysis.fileManifest ?? {});

      // Stage 2: idempotency — skip when an artifact exists for the same manifest.
      const existing = await this.enrichmentRepository.findByAnalysisId(analysisId);

      if (existing !== null && existing.manifestSha256 === manifestSha256) {
        await this.eventDispatcher.dispatch(
          new EnrichmentSkippedEvent(
            analysisId,
            repositoryId,
            snapshotId,
            correlationId,
            'manifest_unchanged',
          ),
        );
        this.logger.log(`Enrichment skipped for analysis ${analysisId} (manifest unchanged)`);
        return;
      }

      // Stage 3: assemble context from KG + IR.
      const { sketches, kgContext } = await this.contextAssembler.assemble(analysisId);

      if (sketches.length === 0) {
        await this.eventDispatcher.dispatch(
          new EnrichmentSkippedEvent(
            analysisId,
            repositoryId,
            snapshotId,
            correlationId,
            'no_source_units',
          ),
        );
        this.logger.warn(`No source units to enrich for analysis ${analysisId}; skipping`);
        return;
      }

      // Stage 4: build the prompt with framework semantics. Candidates are
      // captured deterministically at analysis time (manifest markers) and
      // confirmed by the LLM (ADR-2/3); the top candidate drives the format
      // config, generic on ambiguity or when no manifest exists.
      const { candidates, primary } = detectFrameworkCandidates(analysis);
      const prompt = this.promptBuilder.build({
        capabilityId: CLASSIFY_LIFECYCLE_CAPABILITY,
        framework: primary,
        frameworkCandidates: candidates,
        kgContext,
        sketches,
      });

      // Stage 5: call the provider (schema gate may retry once with feedback).
      const provider = await this.providerSelector.getProvider();
      const request = {
        messages: [{ role: 'system' as const, content: prompt }],
        capability: CLASSIFY_LIFECYCLE_CAPABILITY,
        framework: primary,
        manifestSha256,
      };
      const response = await provider.enrich(request);

      // Stage 6: three-gate validation — retry once with feedback on schema failure.
      let validated: ValidatedEnrichment;

      try {
        validated = this.validator.validate(response, analysis.ir);
      } catch (error) {
        if (!(error instanceof AIDidNotMeetSchemaError)) {
          throw error;
        }

        this.logger.warn(
          `Schema gate rejected provider output for analysis ${analysisId}; retrying once with feedback`,
        );
        const feedback = SCHEMA_RETRY_FEEDBACK.replace('%s', error.message);
        const retried = await provider.enrich({
          ...request,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: feedback },
          ],
        });
        validated = this.validator.validate(retried, analysis.ir);
      }

      // Stage 7: persist the immutable artifact + emit completed.
      const enrichment = IrEnrichment.create({
        analysisId,
        repositoryId,
        manifestSha256,
        framework: validated.framework,
        architecture: validated.architecture,
        confidence: validated.confidence,
        classes: validated.classes,
        failedUnits: validated.failedUnits,
      });

      await this.enrichmentRepository.save(enrichment);

      const unitCount = validated.classes.length + validated.failedUnits.length;

      await this.eventDispatcher.dispatch(
        new EnrichmentCompletedEvent(
          analysisId,
          repositoryId,
          snapshotId,
          correlationId,
          unitCount,
          validated.failedUnits.length,
        ),
      );

      this.logger.log(
        `Enrichment completed for analysis ${analysisId}: ${unitCount} units, ${validated.failedUnits.length} failed`,
      );
    } catch (error) {
      if (options.finalAttempt === true) {
        await this.eventDispatcher.dispatch(
          new EnrichmentFailedEvent(
            analysisId,
            repositoryId,
            snapshotId,
            correlationId,
            0,
            0,
            this.failureReason(error),
          ),
        );
      }

      throw error;
    }
  }

  private failureReason(error: unknown): string {
    if (error instanceof BaseAIError) {
      return error.code.toLowerCase().replace(/_/g, '_');
    }

    return 'pipeline_error';
  }
}

/**
 * Manifest-based framework detection (ADR-2/3, spec "Manifest-Based Framework
 * Detection"): returns the candidates captured at analysis time together with
 * the primary framework that selects the format config.
 *
 * - No manifest candidates → `primary: 'unknown'`, confidence 0 (never
 *   guessed); the prompt instructs the LLM accordingly.
 * - Multiple distinct candidate frameworks → `primary: 'unknown'` so the
 *   generic format config is used on ambiguity (ADR-3) and the LLM decides.
 * - A single distinct framework → that framework drives the config.
 *
 * The LLM output remains authoritative: the prompt asks it to confirm/refine
 * `{ framework, architecture, confidence }` from the candidates + entry-point
 * sketches.
 */
export interface FrameworkCandidateResult {
  candidates: FrameworkCandidate[];
  primary: string;
}

export function detectFrameworkCandidates(
  analysis: Pick<Analysis, 'frameworkCandidates'>,
): FrameworkCandidateResult {
  const candidates = [...(analysis.frameworkCandidates ?? [])];
  const distinctFrameworks = new Set(candidates.map((candidate) => candidate.framework));
  const primary = distinctFrameworks.size === 1 ? candidates[0].framework : 'unknown';

  return { candidates, primary };
}

/**
 * Lightweight framework detection from the IR (REQ-PM-006): scans decorators
 * and resolved imports for NestJS/Express markers. Unknown frameworks fall
 * back to the generic format config.
 *
 * Kept as the deterministic fallback (ADR-3) for the per-unit fallback path
 * when the LLM cannot run; the pipeline itself uses manifest candidates via
 * `detectFrameworkCandidates`.
 */
export function detectFramework(ir: IrProject): string {
  let nestjs = false;
  let express = false;

  for (const pkg of ir.packages) {
    for (const mod of pkg.modules) {
      if (mod.imports.some((specifier) => specifier.includes('@nestjs'))) {
        nestjs = true;
      }

      if (
        mod.imports.some((specifier) => specifier === 'express' || specifier.includes('express'))
      ) {
        express = true;
      }

      for (const cls of mod.classes) {
        for (const decorator of cls.decorators) {
          if (
            /^@(Controller|Injectable|Module|Get|Post|Put|Delete|Patch|UseGuards|UsePipes|UseInterceptors)/.test(
              decorator,
            )
          ) {
            nestjs = true;
          }
        }
      }
    }
  }

  if (nestjs) {
    return 'nestjs';
  }

  if (express) {
    return 'express';
  }

  return 'unknown';
}
