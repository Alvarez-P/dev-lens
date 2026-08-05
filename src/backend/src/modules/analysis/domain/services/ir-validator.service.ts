import { Injectable } from '@nestjs/common';
import { ValueObject } from '../../../../shared/domain/value-object';
import { IrProject, IrClass, IrDependency, IrRelationship } from '../ir-nodes';

export class ValidationResult extends ValueObject {
  private constructor(
    public readonly isValid: boolean,
    public readonly errors: readonly string[],
  ) {
    super();
  }

  static valid(): ValidationResult {
    return new ValidationResult(true, Object.freeze([]));
  }

  static invalid(errors: string[]): ValidationResult {
    return new ValidationResult(false, Object.freeze([...errors]));
  }

  protected getEqualityComponents(): unknown[] {
    return [this.isValid, this.errors];
  }
}

interface IrNodeRef {
  fqn: string;
  type: string;
}

@Injectable()
export class IrValidator {
  validate(ir: IrProject): ValidationResult {
    const errors: string[] = [];
    const nodeRefs = this.collectNodes(ir);
    const nodeFqns = new Set(nodeRefs.map((ref) => ref.fqn));

    this.checkStructural(ir, nodeRefs, errors);
    this.checkUniqueness(nodeRefs, ir.dependencies, ir.relationships, errors);
    this.checkRelationships(ir, nodeFqns, errors);
    this.checkReferential(ir, nodeFqns, errors);

    return errors.length === 0 ? ValidationResult.valid() : ValidationResult.invalid(errors);
  }

  private collectNodes(ir: IrProject): IrNodeRef[] {
    const refs: IrNodeRef[] = [{ fqn: ir.fqn, type: 'project' }];

    for (const pkg of ir.packages) {
      refs.push({ fqn: pkg.fqn, type: 'package' });

      for (const mod of pkg.modules) {
        refs.push({ fqn: mod.fqn, type: 'module' });

        for (const cls of mod.classes) {
          refs.push({ fqn: cls.fqn, type: 'class' });

          for (const method of cls.methods) {
            refs.push({ fqn: method.fqn, type: 'method' });
          }

          for (const endpoint of cls.endpoints) {
            refs.push({ fqn: endpoint.fqn, type: 'endpoint' });
          }
        }

        for (const iface of mod.interfaces) {
          refs.push({ fqn: iface.fqn, type: 'interface' });
        }

        for (const fn of mod.functions) {
          refs.push({ fqn: fn.fqn, type: 'function' });
        }
      }
    }

    return refs;
  }

  private checkStructural(ir: IrProject, nodeRefs: IrNodeRef[], errors: string[]): void {
    for (const ref of nodeRefs) {
      if (!ref.fqn.trim()) {
        errors.push(`Node of type "${ref.type}" has an empty identifier`);
      }
    }

    if (ir.packages.length === 0) {
      errors.push('Project must contain at least one package');
    }

    for (const pkg of ir.packages) {
      if (pkg.modules.length === 0) {
        errors.push(`Package "${pkg.fqn}" must contain at least one module`);
      }
    }
  }

  private checkUniqueness(
    nodeRefs: IrNodeRef[],
    dependencies: readonly IrDependency[],
    relationships: readonly IrRelationship[],
    errors: string[],
  ): void {
    const seen = new Set<string>();

    for (const ref of nodeRefs) {
      this.trackFqn(ref.fqn, seen, errors);
    }

    for (const dependency of dependencies) {
      this.trackFqn(dependency.fqn, seen, errors);
    }

    for (const relationship of relationships) {
      this.trackFqn(relationship.fqn, seen, errors);
    }
  }

  private trackFqn(fqn: string, seen: Set<string>, errors: string[]): void {
    if (seen.has(fqn)) {
      errors.push(`Duplicate identifier "${fqn}"`);
    }
    seen.add(fqn);
  }

  private checkRelationships(ir: IrProject, nodeFqns: Set<string>, errors: string[]): void {
    for (const relationship of ir.relationships) {
      if (!nodeFqns.has(relationship.from)) {
        errors.push(
          `Relationship "${relationship.fqn}" references unknown node "${relationship.from}"`,
        );
      }

      if (!nodeFqns.has(relationship.to)) {
        errors.push(
          `Relationship "${relationship.fqn}" references unknown node "${relationship.to}"`,
        );
      }
    }
  }

  private checkReferential(ir: IrProject, nodeFqns: Set<string>, errors: string[]): void {
    for (const dependency of ir.dependencies) {
      if (!nodeFqns.has(dependency.source)) {
        errors.push(
          `Dependency "${dependency.fqn}" references unknown source "${dependency.source}"`,
        );
      }

      if (this.isInternalReference(dependency.target) && !nodeFqns.has(dependency.target)) {
        errors.push(
          `Dependency "${dependency.fqn}" references unknown target "${dependency.target}"`,
        );
      }
    }

    for (const pkg of ir.packages) {
      for (const mod of pkg.modules) {
        for (const cls of mod.classes) {
          this.checkClassReferences(cls, nodeFqns, errors);
        }
      }
    }
  }

  private checkClassReferences(cls: IrClass, nodeFqns: Set<string>, errors: string[]): void {
    if (
      cls.extends !== null &&
      this.isInternalReference(cls.extends) &&
      !nodeFqns.has(cls.extends)
    ) {
      errors.push(`Class "${cls.fqn}" extends unknown node "${cls.extends}"`);
    }

    for (const implemented of cls.implements) {
      if (this.isInternalReference(implemented) && !nodeFqns.has(implemented)) {
        errors.push(`Class "${cls.fqn}" implements unknown node "${implemented}"`);
      }
    }
  }

  private isInternalReference(value: string): boolean {
    return value.includes(':');
  }
}
