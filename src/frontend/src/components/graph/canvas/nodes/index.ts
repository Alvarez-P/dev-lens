import type { NodeTypes } from '@xyflow/react';
import { NodeType } from '@/lib/visualization/types';
import { ProjectNode } from './project-node';
import { PackageNode } from './package-node';
import { ModuleNode } from './module-node';
import { ControllerNode } from './controller-node';
import { ServiceNode } from './service-node';
import { RepositoryNode } from './repository-node';
import { EntityNode } from './entity-node';
import { DtoNode } from './dto-node';
import { InterfaceNode } from './interface-node';
import { EndpointNode } from './endpoint-node';
import { ExternalDependencyNode } from './external-dependency-node';
import { UnknownNode } from './unknown-node';

export {
  ProjectNode,
  PackageNode,
  ModuleNode,
  ControllerNode,
  ServiceNode,
  RepositoryNode,
  EntityNode,
  DtoNode,
  InterfaceNode,
  EndpointNode,
  ExternalDependencyNode,
  UnknownNode,
};

/**
 * Registry keyed by `NodeType` enum value — passed to the ReactFlowAdapter
 * as its `nodeTypes` prop so React Flow renders the matching custom node.
 */
export const nodeTypes: NodeTypes = {
  [NodeType.PROJECT]: ProjectNode,
  [NodeType.PACKAGE]: PackageNode,
  [NodeType.MODULE]: ModuleNode,
  [NodeType.CONTROLLER]: ControllerNode,
  [NodeType.SERVICE]: ServiceNode,
  [NodeType.REPOSITORY]: RepositoryNode,
  [NodeType.ENTITY]: EntityNode,
  [NodeType.DTO]: DtoNode,
  [NodeType.INTERFACE]: InterfaceNode,
  [NodeType.ENDPOINT]: EndpointNode,
  [NodeType.EXTERNAL_DEPENDENCY]: ExternalDependencyNode,
  [NodeType.UNKNOWN]: UnknownNode,
};
