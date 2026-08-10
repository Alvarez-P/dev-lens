import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { ClassConstructor } from 'class-transformer';

/**
 * Post-generation validation rule kinds supported in MVP (spec R4).
 */
export type ValidationRuleKind = 'completeness' | 'schema' | 'length' | 'safety' | 'groundedness';

/** Required fields present (object-shaped responses). */
export interface CompletenessRule {
  kind: 'completeness';
  requiredFields: string[];
}

/** JSON response validated against a class-validator DTO (spec R3). */
export interface SchemaRule {
  kind: 'schema';
  dto: ClassConstructor<object>;
}

/** Response does not exceed a maximum number of characters. */
export interface LengthRule {
  kind: 'length';
  maxChars: number;
}

/** Basic pattern blocklist — e.g. private keys, secrets. */
export interface SafetyRule {
  kind: 'safety';
  blockedPatterns: RegExp[];
}

/**
 * Every entity referenced by the response must exist in the provided context.
 * `entityPattern` extracts referenced entity names (e.g. `\b[A-Z][A-Za-z]+Module\b`).
 */
export interface GroundednessRule {
  kind: 'groundedness';
  entityPattern: RegExp;
}

export type ValidationRule =
  CompletenessRule | SchemaRule | LengthRule | SafetyRule | GroundednessRule;

export interface ValidationViolation {
  rule: ValidationRuleKind;
  message: string;
}

export interface ValidationResult {
  passed: boolean;
  violations: ValidationViolation[];
}

/** Coerces an unknown response into a plain object for object-shaped rules. */
function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);

      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Runs the capability's validation rules against a generated response
 * (spec R4). Every rule returns violations; the response passes when no rule
 * produces one. `context` is only consumed by groundedness rules.
 */
export function runValidation(
  rules: readonly ValidationRule[],
  response: unknown,
  context = '',
): ValidationResult {
  const violations: ValidationViolation[] = [];

  for (const rule of rules) {
    switch (rule.kind) {
      case 'completeness': {
        const payload = asObject(response);

        if (payload === null) {
          violations.push({ rule: rule.kind, message: 'response is not a JSON object' });
          break;
        }

        for (const field of rule.requiredFields) {
          if (!(field in payload)) {
            violations.push({ rule: rule.kind, message: `missing required field "${field}"` });
          }
        }
        break;
      }

      case 'schema': {
        const payload = asObject(response);

        if (payload === null) {
          violations.push({ rule: rule.kind, message: 'response is not valid JSON' });
          break;
        }

        const instance = plainToInstance(rule.dto, payload);
        const errors = validateSync(instance, {
          whitelist: true,
          forbidNonWhitelisted: true,
          validationError: { target: false, value: false },
        });

        if (errors.length > 0) {
          const fields = errors.map((error) => error.property).join(', ');
          violations.push({
            rule: rule.kind,
            message: `response failed schema validation: ${fields}`,
          });
        }
        break;
      }

      case 'length': {
        const text = String(response);

        if (text.length > rule.maxChars) {
          violations.push({
            rule: rule.kind,
            message: `response exceeds ${rule.maxChars} characters`,
          });
        }
        break;
      }

      case 'safety': {
        const text = String(response);

        if (
          rule.blockedPatterns.some((pattern) => {
            pattern.lastIndex = 0;
            return pattern.test(text);
          })
        ) {
          violations.push({ rule: rule.kind, message: 'response matches a blocked pattern' });
        }
        break;
      }

      case 'groundedness': {
        const text = String(response);
        const entities = [...text.matchAll(rule.entityPattern)].map((match) => match[0]);

        for (const entity of new Set(entities)) {
          if (!context.includes(entity)) {
            violations.push({ rule: rule.kind, message: `"${entity}" not found in context` });
          }
        }
        break;
      }
    }
  }

  return { passed: violations.length === 0, violations };
}
