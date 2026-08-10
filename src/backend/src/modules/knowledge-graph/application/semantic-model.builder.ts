import {
  IrProject,
  IrPackage,
  IrModule,
  IrClass,
  IrInterface,
  IrFunction,
  IrEndpoint,
  IrDependency,
  IrRelationship,
} from '../../analysis/domain/ir-nodes';
import { NodeType } from '../domain/node-type.enum';
import { EdgeType } from '../domain/edge-type.enum';
import { SemanticModel, SemanticNode, SemanticEdge } from '../domain/semantic-model';
import { IrEnrichment } from '../../ai/domain/ai-enrichment.entity';
import { parseLifecycleEntry } from '../../ai/application/three-gates-validator.service';

const ROLE_TO_TYPE: Readonly<Record<string, NodeType>> = {
  controller: NodeType.CONTROLLER,
  service: NodeType.SERVICE,
  repository: NodeType.REPOSITORY,
  dto: NodeType.DTO,
  entity: NodeType.ENTITY,
  guard: NodeType.GUARD,
  pipe: NodeType.PIPE,
  interceptor: NodeType.INTERCEPTOR,
  middleware: NodeType.MIDDLEWARE,
  module: NodeType.MODULE,
  interface: NodeType.INTERFACE,
};

/** Edge from a lifecycle node to the class it guards/transforms (REQ-EP-007). */
const LIFECYCLE_EDGE: Readonly<Record<string, EdgeType>> = {
  guard: EdgeType.PROTECTS,
  pipe: EdgeType.TRANSFORMS,
  interceptor: EdgeType.TRANSFORMS,
  middleware: EdgeType.TRANSFORMS,
};

/** Parameter type annotations that never reference a resolvable DTO class. */
const PRIMITIVE_TYPES: ReadonlySet<string> = new Set([
  'string',
  'number',
  'boolean',
  'bigint',
  'symbol',
  'undefined',
  'null',
  'void',
  'any',
  'unknown',
  'never',
  'object',
]);

export class SemanticModelBuilder {
  build(ir: IrProject, enrichment?: IrEnrichment): SemanticModel {
    const nodes: SemanticNode[] = [];
    const edges: SemanticEdge[] = [];
    const knownFqns = new Set<string>([ir.fqn]);

    nodes.push(this.projectNode(ir, enrichment));

    for (const pkg of ir.packages) {
      knownFqns.add(pkg.fqn);
      nodes.push(this.packageNode(pkg));
      edges.push(this.belongsTo(pkg.fqn, ir.fqn));

      for (const mod of pkg.modules) {
        knownFqns.add(mod.fqn);
        const sourceFile = normalizeSourceFile(mod.path, ir.rootPath);
        nodes.push(this.moduleNode(mod, sourceFile));
        edges.push(this.belongsTo(mod.fqn, pkg.fqn));

        for (const cls of mod.classes) {
          knownFqns.add(cls.fqn);
          const classNode = this.classNode(cls, sourceFile, enrichment);
          nodes.push(classNode);
          edges.push(this.belongsTo(cls.fqn, mod.fqn));

          if (enrichment !== undefined) {
            this.addLifecycleNodes(cls, enrichment, ir.rootPath, nodes, edges);
          }

          for (const endpoint of cls.endpoints) {
            knownFqns.add(endpoint.fqn);
            nodes.push(this.endpointNode(endpoint, sourceFile));
            edges.push(this.exposes(cls.fqn, endpoint.fqn));
          }
        }

        for (const iface of mod.interfaces) {
          knownFqns.add(iface.fqn);
          nodes.push(this.interfaceNode(iface, sourceFile));
          edges.push(this.belongsTo(iface.fqn, mod.fqn));
        }

        for (const fn of mod.functions) {
          knownFqns.add(fn.fqn);
          nodes.push(this.functionNode(fn, sourceFile));
          edges.push(this.belongsTo(fn.fqn, mod.fqn));
        }
      }
    }

    this.addImportEdges(ir.dependencies, knownFqns, nodes, edges);
    this.addRelationshipEdges(ir.relationships, edges);
    this.addFlowEdges(ir, enrichment, nodes, edges);

    return {
      nodes: this.dedupeSortedNodes(nodes),
      edges: this.dedupeSortedEdges(edges),
    };
  }

  /**
   * REQ-FLOW: endpoint-level lifecycle (PROTECTS/TRANSFORMS), constructor DI
   * (INJECTS), approximate call chain (INVOKES), and parameter-type DTO
   * dependencies (DEPENDS_ON). Runs after the structural loop so every class
   * and endpoint node already exists for label-based resolution.
   */
  private addFlowEdges(
    ir: IrProject,
    enrichment: IrEnrichment | undefined,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    for (const pkg of ir.packages) {
      for (const mod of pkg.modules) {
        const sourceFile = normalizeSourceFile(mod.path, ir.rootPath);

        for (const cls of mod.classes) {
          const classNodeType = this.resolveClassType(cls, mod.path, enrichment);

          for (const endpoint of cls.endpoints) {
            this.addEndpointLifecycleEdges(endpoint, cls, sourceFile, nodes, edges);
            this.addDtoEdges(endpoint, nodes, edges);
          }

          this.addInjectsEdges(cls, nodes, edges);
          this.addInvokesEdges(cls, classNodeType, nodes, edges);
        }
      }
    }
  }

  /**
   * Endpoint-level lifecycle entries reuse the class-level lifecycle-node FQN
   * scheme (`${cls.fqn}~kind:name`); FQN dedup prevents duplicate nodes when
   * a class-level (AI) entry and an endpoint-level (parser) entry overlap.
   * The `order` property preserves decorator order for the flow API.
   */
  private addEndpointLifecycleEdges(
    endpoint: IrEndpoint,
    cls: IrClass,
    sourceFile: string | null,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    endpoint.lifecycle.forEach((entry, index) => {
      const type = ROLE_TO_TYPE[entry.kind];

      if (type === undefined) {
        return;
      }

      const lifecycleFqn = `${cls.fqn}~${entry.kind}:${entry.classRef}`;

      if (!nodes.some((node) => node.fqn === lifecycleFqn)) {
        nodes.push({
          type,
          label: entry.classRef,
          fqn: lifecycleFqn,
          properties: { lifecycleKind: entry.kind, order: index },
          sourceFile,
        });
      }

      edges.push({
        type: LIFECYCLE_EDGE[entry.kind],
        sourceFqn: lifecycleFqn,
        targetFqn: endpoint.fqn,
      });
    });
  }

  /** Constructor dependency injection: dependent class -> injected dependency. */
  private addInjectsEdges(cls: IrClass, nodes: SemanticNode[], edges: SemanticEdge[]): void {
    for (const param of cls.constructorParams) {
      const target = this.resolveNodeByLabel(nodes, param.type);

      if (target === undefined) {
        continue;
      }

      edges.push({
        type: EdgeType.INJECTS,
        sourceFqn: cls.fqn,
        targetFqn: target.fqn,
      });
    }
  }

  /**
   * Approximate call chain (Controller -> Service -> Repository) derived from
   * constructor DI order. `approximate: true` signals the chain is inferred,
   * not read from method bodies.
   */
  private addInvokesEdges(
    cls: IrClass,
    classNodeType: NodeType,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    if (classNodeType !== NodeType.CONTROLLER && classNodeType !== NodeType.SERVICE) {
      return;
    }

    for (const param of cls.constructorParams) {
      const target = this.resolveNodeByLabel(nodes, param.type);

      if (target === undefined) {
        continue;
      }

      if (target.type !== NodeType.SERVICE && target.type !== NodeType.REPOSITORY) {
        continue;
      }

      edges.push({
        type: EdgeType.INVOKES,
        sourceFqn: cls.fqn,
        targetFqn: target.fqn,
        properties: { approximate: true },
      });
    }
  }

  /** Endpoint -> DTO dependency for parameter type annotations from typedParams. */
  private addDtoEdges(endpoint: IrEndpoint, nodes: SemanticNode[], edges: SemanticEdge[]): void {
    for (const param of endpoint.typedParams) {
      if (PRIMITIVE_TYPES.has(param.typeAnnotation)) {
        continue;
      }

      const target = this.resolveNodeByLabel(nodes, param.typeAnnotation);

      if (target === undefined) {
        continue;
      }

      edges.push({
        type: EdgeType.DEPENDS_ON,
        sourceFqn: endpoint.fqn,
        targetFqn: target.fqn,
        properties: { reason: 'parameter-type', paramName: param.name },
      });
    }
  }

  private resolveNodeByLabel(nodes: SemanticNode[], label: string): SemanticNode | undefined {
    return nodes.find((node) => node.label === label);
  }

  private addImportEdges(
    dependencies: readonly IrDependency[],
    knownFqns: Set<string>,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const externalNodes = new Map<string, SemanticNode>();

    for (const dependency of dependencies) {
      if (dependency.type !== 'import') {
        continue;
      }

      if (knownFqns.has(dependency.target)) {
        edges.push({
          type: EdgeType.DEPENDS_ON,
          sourceFqn: dependency.source,
          targetFqn: dependency.target,
        });
        continue;
      }

      if (!externalNodes.has(dependency.target)) {
        const node: SemanticNode = {
          type: NodeType.EXTERNAL_DEPENDENCY,
          label: dependency.target,
          fqn: dependency.target,
          properties: {},
          sourceFile: null,
        };

        externalNodes.set(dependency.target, node);
        nodes.push(node);
      }

      edges.push({
        type: EdgeType.IMPORTS,
        sourceFqn: dependency.source,
        targetFqn: dependency.target,
      });
    }
  }

  private addRelationshipEdges(
    relationships: readonly IrRelationship[],
    edges: SemanticEdge[],
  ): void {
    for (const relationship of relationships) {
      if (relationship.kind === 'extends') {
        edges.push({
          type: EdgeType.EXTENDS,
          sourceFqn: relationship.from,
          targetFqn: relationship.to,
        });
      } else if (relationship.kind === 'implements') {
        edges.push({
          type: EdgeType.IMPLEMENTS,
          sourceFqn: relationship.from,
          targetFqn: relationship.to,
        });
      }
    }
  }

  private projectNode(ir: IrProject, enrichment?: IrEnrichment): SemanticNode {
    const properties: Record<string, unknown> = {
      language: ir.language.name,
      rootPath: ir.rootPath,
    };

    if (enrichment !== undefined) {
      properties.framework = enrichment.framework;
      properties.architecture = enrichment.architecture;
    }

    return {
      type: NodeType.PROJECT,
      label: ir.name,
      fqn: ir.fqn,
      properties,
      sourceFile: null,
    };
  }

  private packageNode(pkg: IrPackage): SemanticNode {
    const properties: Record<string, unknown> = {};

    if (pkg.version !== null) {
      properties.version = pkg.version;
    }

    return {
      type: NodeType.PACKAGE,
      label: pkg.name,
      fqn: pkg.fqn,
      properties,
      sourceFile: null,
    };
  }

  private moduleNode(mod: IrModule, sourceFile: string | null): SemanticNode {
    return {
      type: NodeType.MODULE,
      label: mod.name,
      fqn: mod.fqn,
      properties: {},
      sourceFile,
    };
  }

  private classNode(
    cls: IrClass,
    sourceFile: string | null,
    enrichment?: IrEnrichment,
  ): SemanticNode {
    const properties: Record<string, unknown> = {
      isAbstract: cls.isAbstract,
      isExported: cls.isExported,
    };

    if (cls.role !== null) {
      properties.role = cls.role;
    }

    const aiRole = enrichment?.classes.find((entry) => entry.fqn === cls.fqn);

    if (aiRole !== undefined) {
      properties.role = aiRole.role;

      if (aiRole.dtoFields.length > 0) {
        properties.dtoFields = aiRole.dtoFields;
      }
    }

    return {
      type: this.resolveClassType(cls, sourceFile ?? '', enrichment),
      label: cls.name,
      fqn: cls.fqn,
      properties,
      sourceFile,
    };
  }

  /**
   * REQ-EP-007: AI role overrides the heuristic when enrichment exists.
   * Unmapped roles (e.g. `other`) fall through to the deterministic path.
   */
  private resolveClassType(cls: IrClass, filePath: string, enrichment?: IrEnrichment): NodeType {
    const aiEntry = enrichment?.classes.find((entry) => entry.fqn === cls.fqn);

    if (aiEntry !== undefined) {
      const aiType = ROLE_TO_TYPE[aiEntry.role];

      if (aiType !== undefined) {
        return aiType;
      }
    }

    if (cls.role !== null) {
      const roleType = ROLE_TO_TYPE[cls.role];

      if (roleType !== undefined) {
        return roleType;
      }
    }

    if (cls.name.endsWith('Dto') || cls.name.endsWith('DTO')) {
      return NodeType.DTO;
    }

    if (cls.name.endsWith('Entity')) {
      return NodeType.ENTITY;
    }

    const pathSegments = filePath.split(/[/\\]/);

    if (pathSegments.includes('entities') || pathSegments.includes('domain')) {
      return NodeType.ENTITY;
    }

    if (/^I[A-Z]/.test(cls.name)) {
      return NodeType.INTERFACE;
    }

    return NodeType.UNKNOWN;
  }

  /**
   * REQ-EP-007: `AIClassifiedRole.lifecycle` entries like `guard:JwtGuard`
   * become GUARD/PIPE/INTERCEPTOR/MIDDLEWARE nodes with PROTECTS/TRANSFORMS
   * edges pointing at the owning class node. Plain `handler` entries are the
   * class itself and produce no node.
   */
  private addLifecycleNodes(
    cls: IrClass,
    enrichment: IrEnrichment,
    rootPath: string,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const aiEntry = enrichment.classes.find((entry) => entry.fqn === cls.fqn);

    if (aiEntry === undefined) {
      return;
    }

    for (const entry of aiEntry.lifecycle) {
      const parsed = parseLifecycleEntry(entry);

      if (parsed === null) {
        continue;
      }

      const type = ROLE_TO_TYPE[parsed.kind];

      if (type === undefined) {
        continue;
      }

      const lifecycleFqn = `${cls.fqn}~${parsed.kind}:${parsed.name}`;

      if (nodes.some((node) => node.fqn === lifecycleFqn)) {
        continue;
      }

      nodes.push({
        type,
        label: parsed.name,
        fqn: lifecycleFqn,
        properties: { lifecycleKind: parsed.kind },
        sourceFile: normalizeSourceFile(aiEntry.sourceFile, rootPath),
      });

      edges.push({
        type: LIFECYCLE_EDGE[parsed.kind],
        sourceFqn: lifecycleFqn,
        targetFqn: cls.fqn,
      });
    }
  }

  private interfaceNode(iface: IrInterface, sourceFile: string | null): SemanticNode {
    return {
      type: NodeType.INTERFACE,
      label: iface.name,
      fqn: iface.fqn,
      properties: { isExported: iface.isExported },
      sourceFile,
    };
  }

  private functionNode(fn: IrFunction, sourceFile: string | null): SemanticNode {
    return {
      type: NodeType.UNKNOWN,
      label: fn.name,
      fqn: fn.fqn,
      properties: { isAsync: fn.isAsync, isExported: fn.isExported },
      sourceFile,
    };
  }

  private endpointNode(endpoint: IrEndpoint, sourceFile: string | null): SemanticNode {
    return {
      type: NodeType.ENDPOINT,
      label: endpoint.name,
      fqn: endpoint.fqn,
      properties: { httpMethod: endpoint.httpMethod, path: endpoint.path },
      sourceFile,
    };
  }

  private belongsTo(sourceFqn: string, targetFqn: string): SemanticEdge {
    return { type: EdgeType.BELONGS_TO, sourceFqn, targetFqn };
  }

  private exposes(sourceFqn: string, targetFqn: string): SemanticEdge {
    return { type: EdgeType.EXPOSES, sourceFqn, targetFqn };
  }

  private dedupeSortedNodes(nodes: SemanticNode[]): SemanticNode[] {
    const sorted = [...nodes].sort((a, b) => compareStrings(a.fqn, b.fqn));
    const unique: SemanticNode[] = [];
    const seen = new Set<string>();

    for (const node of sorted) {
      if (!seen.has(node.fqn)) {
        seen.add(node.fqn);
        unique.push(node);
      }
    }

    return unique;
  }

  private dedupeSortedEdges(edges: SemanticEdge[]): SemanticEdge[] {
    const sorted = [...edges].sort(
      (a, b) =>
        compareStrings(a.type, b.type) ||
        compareStrings(a.sourceFqn, b.sourceFqn) ||
        compareStrings(a.targetFqn, b.targetFqn),
    );
    const unique: SemanticEdge[] = [];
    const seen = new Set<string>();

    for (const edge of sorted) {
      const key = `${edge.type}|${edge.sourceFqn}|${edge.targetFqn}|${JSON.stringify(
        edge.properties ?? {},
      )}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(edge);
      }
    }

    return unique;
  }
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * REQ-KG: turns an IR file path into a normalized, repo-relative `sourceFile`.
 * Strips the repository root prefix, converts backslashes to forward slashes,
 * and drops a leading `./`. Returns null when no meaningful path remains
 * (synthesized nodes such as PROJECT, PACKAGE, EXTERNAL_DEPENDENCY).
 */
function normalizeSourceFile(filePath: string, rootPath: string): string | null {
  let relative = filePath;
  const normalizedRoot = rootPath.replace(/\/+$/, '');

  if (normalizedRoot.length > 0 && relative.startsWith(normalizedRoot)) {
    relative = relative.slice(normalizedRoot.length).replace(/^\/+/, '');
  }

  relative = relative.replace(/\\/g, '/').replace(/^\.\//, '');

  return relative.length > 0 ? relative : null;
}
