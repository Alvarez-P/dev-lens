import { NodeView } from './node-view';
import { NODE_STYLE } from './node-style';
import { NodeType } from '@/lib/visualization/types';
import type { NodeProps } from '@xyflow/react';

export function PipeNode(props: NodeProps) {
  return <NodeView {...props} style={NODE_STYLE[NodeType.PIPE]} />;
}
