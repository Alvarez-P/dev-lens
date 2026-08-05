import type { ReactNode } from 'react';
import type { EdgeProps } from '@xyflow/react';
import { EdgeType } from '@/lib/visualization/types';
import { EdgePath } from './edge-path';
import { EDGE_STYLE } from './edge-style';

export function ImplementsEdge(props: EdgeProps): ReactNode {
  return <EdgePath {...props} styleConfig={EDGE_STYLE[EdgeType.IMPLEMENTS]} />;
}
