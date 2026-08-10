import type { ReactNode } from 'react';
import type { EdgeProps } from '@xyflow/react';
import { EdgeType } from '@/lib/visualization/types';
import { EdgePath } from './edge-path';
import { EDGE_STYLE } from './edge-style';

/** INVOKES edge — inferred service/repository invocation from the flow service tail. */
export function InvokesEdge(props: EdgeProps): ReactNode {
  return <EdgePath {...props} styleConfig={EDGE_STYLE[EdgeType.INVOKES]} />;
}
