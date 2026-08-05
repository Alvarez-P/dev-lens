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

const ROLE_TO_TYPE: Readonly<Record<string, NodeType>> = {
  controller: NodeType.CONTROLLER,
  service: NodeType.SERVICE,
  repository: NodeType.REPOSITORY,
};

export class SemanticModelBuilder {
  build(ir: IrProject): SemanticModel {
    const nodes: SemanticNode[] = [];
    const edges: SemanticEdge[] = [];
    const knownFqns = new Set<string>([ir.fqn]);

    nodes.push(this.projectNode(ir));

    for (const pkg of ir.packages) {
      knownFqns.add(pkg.fqn);
      nodes.push(this.packageNode(pkg));
      edges.push(this.belongsTo(pkg.fqn, ir.fqn));

      for (const mod of pkg.modules) {
        knownFqns.add(mod.fqn);
        nodes.push(this.moduleNode(mod));
        edges.push(this.belongsTo(mod.fqn, pkg.fqn));

        for (const cls of mod.classes) {
          knownFqns.add(cls.fqn);
          nodes.push(this.classNode(cls, mod.path));
          edges.push(this.belongsTo(cls.fqn, mod.fqn));

          for (const endpoint of cls.endpoints) {
            knownFqns.add(endpoint.fqn);
            nodes.push(this.endpointNode(endpoint, mod.path));
            edges.push(this.exposes(cls.fqn, endpoint.fqn));
          }
        }

        for (const iface of mod.interfaces) {
          knownFqns.add(iface.fqn);
          nodes.push(this.interfaceNode(iface, mod.path));
          edges.push(this.belongsTo(iface.fqn, mod.fqn));
        }

        for (const fn of mod.functions) {
          knownFqns.add(fn.fqn);
          nodes.push(this.functionNode(fn, mod.path));
          edges.push(this.belongsTo(fn.fqn, mod.fqn));
        }
      }
    }

    this.addImportEdges(ir.dependencies, knownFqns, nodes, edges);
    this.addRelationshipEdges(ir.relationships, edges);

    return {
      nodes: this.dedupeSortedNodes(nodes),
      edges: this.dedupeSortedEdges(edges),
    };
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
          sourceFile: '',
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

  private projectNode(ir: IrProject): SemanticNode {
    return {
      type: NodeType.PROJECT,
      label: ir.name,
      fqn: ir.fqn,
      properties: { language: ir.language.name, rootPath: ir.rootPath },
      sourceFile: '',
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
      sourceFile: '',
    };
  }

  private moduleNode(mod: IrModule): SemanticNode {
    return {
      type: NodeType.MODULE,
      label: mod.name,
      fqn: mod.fqn,
      properties: {},
      sourceFile: mod.path,
    };
  }

  private classNode(cls: IrClass, filePath: string): SemanticNode {
    const properties: Record<string, unknown> = {
      isAbstract: cls.isAbstract,
      isExported: cls.isExported,
    };

    if (cls.role !== null) {
      properties.role = cls.role;
    }

    return {
      type: this.resolveClassType(cls, filePath),
      label: cls.name,
      fqn: cls.fqn,
      properties,
      sourceFile: filePath,
    };
  }

  private interfaceNode(iface: IrInterface, filePath: string): SemanticNode {
    return {
      type: NodeType.INTERFACE,
      label: iface.name,
      fqn: iface.fqn,
      properties: { isExported: iface.isExported },
      sourceFile: filePath,
    };
  }

  private functionNode(fn: IrFunction, filePath: string): SemanticNode {
    return {
      type: NodeType.UNKNOWN,
      label: fn.name,
      fqn: fn.fqn,
      properties: { isAsync: fn.isAsync, isExported: fn.isExported },
      sourceFile: filePath,
    };
  }

  private endpointNode(endpoint: IrEndpoint, filePath: string): SemanticNode {
    return {
      type: NodeType.ENDPOINT,
      label: endpoint.name,
      fqn: endpoint.fqn,
      properties: { httpMethod: endpoint.httpMethod, path: endpoint.path },
      sourceFile: filePath,
    };
  }

  private resolveClassType(cls: IrClass, filePath: string): NodeType {
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
      const key = `${edge.type}|${edge.sourceFqn}|${edge.targetFqn}`;

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
