import type { EdgeTypes } from '@xyflow/react';
import { EdgeType } from '@/lib/visualization/types';
import { BelongsToEdge } from './belongs-to-edge';
import { DependsOnEdge } from './depends-on-edge';
import { ImplementsEdge } from './implements-edge';
import { ExtendsEdge } from './extends-edge';
import { ExposesEdge } from './exposes-edge';
import { ImportsEdge } from './imports-edge';
import { ProtectsEdge } from './protects-edge';
import { TransformsEdge } from './transforms-edge';
import { InvokesEdge } from './invokes-edge';
import { InjectsEdge } from './injects-edge';

export {
  BelongsToEdge,
  DependsOnEdge,
  ImplementsEdge,
  ExtendsEdge,
  ExposesEdge,
  ImportsEdge,
  ProtectsEdge,
  TransformsEdge,
  InvokesEdge,
  InjectsEdge,
};

/**
 * Registry keyed by `EdgeType` enum value — passed to the ReactFlowAdapter
 * as its `edgeTypes` prop so React Flow renders the matching custom edge.
 *
 * Cast is required because React Flow types the registry with `data: any`
 * required while `EdgeProps.data` is optional (known @xyflow/react quirk).
 */
export const edgeTypes: EdgeTypes = {
  [EdgeType.BELONGS_TO]: BelongsToEdge as EdgeTypes[string],
  [EdgeType.DEPENDS_ON]: DependsOnEdge as EdgeTypes[string],
  [EdgeType.IMPLEMENTS]: ImplementsEdge as EdgeTypes[string],
  [EdgeType.EXTENDS]: ExtendsEdge as EdgeTypes[string],
  [EdgeType.EXPOSES]: ExposesEdge as EdgeTypes[string],
  [EdgeType.IMPORTS]: ImportsEdge as EdgeTypes[string],
  [EdgeType.PROTECTS]: ProtectsEdge as EdgeTypes[string],
  [EdgeType.TRANSFORMS]: TransformsEdge as EdgeTypes[string],
  [EdgeType.INVOKES]: InvokesEdge as EdgeTypes[string],
  [EdgeType.INJECTS]: InjectsEdge as EdgeTypes[string],
};
