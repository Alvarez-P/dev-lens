import type { ReactNode } from 'react';
import type { NodeProps } from '@xyflow/react';
import { NodeType } from '@/lib/visualization/types';
import { NodeView } from './node-view';
import { NODE_STYLE } from './node-style';

export function EndpointNode(props: NodeProps): ReactNode {
  return <NodeView {...props} style={NODE_STYLE[NodeType.ENDPOINT]} />;
}
