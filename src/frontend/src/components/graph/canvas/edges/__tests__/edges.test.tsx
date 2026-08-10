import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { EdgeProps } from '@xyflow/react';
import { Position } from '@xyflow/react';

vi.mock('@xyflow/react', async () => {
  const { xyflowMock } = await import('../../__tests__/helpers/xyflow-mock');
  return xyflowMock;
});

import { EdgeType } from '@/lib/visualization/types';
import type { GraphEdge } from '@/lib/visualization/types';
import { edgeTypes } from '../index';
import { EDGE_STYLE, dashArray } from '../edge-style';

function makeEdge(type: EdgeType, id = `e-${type}`): GraphEdge {
  return {
    id,
    type,
    sourceNodeId: 'src',
    targetNodeId: 'tgt',
    properties: {},
    version: 1,
  };
}

/** Full EdgeProps surface React Flow hands to a custom edge. */
function makeEdgeProps(edge: GraphEdge): EdgeProps {
  return {
    id: edge.id,
    data: { edge },
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 0,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };
}

describe('edge style config (VE-001 edge table)', () => {
  it('covers every EdgeType in the enum', () => {
    for (const type of Object.values(EdgeType)) {
      expect(EDGE_STYLE[type], `missing style for ${type}`).toBeDefined();
    }
  });

  it('matches the design style/color mapping', () => {
    expect(EDGE_STYLE[EdgeType.BELONGS_TO]).toEqual({
      color: '#505054',
      dash: 'solid',
      arrow: false,
      width: 1,
    }); // surface-500
    expect(EDGE_STYLE[EdgeType.DEPENDS_ON]).toEqual({
      color: '#a1a1a4',
      dash: 'solid',
      arrow: true,
      width: 1.5,
    }); // surface-300
    expect(EDGE_STYLE[EdgeType.IMPLEMENTS]).toEqual({
      color: '#47e02e',
      dash: 'dashed',
      arrow: true,
      width: 1.5,
    }); // success-400
    expect(EDGE_STYLE[EdgeType.EXTENDS]).toEqual({
      color: '#d6ff2e',
      dash: 'solid',
      arrow: true,
      width: 1.5,
    }); // primary-400
    expect(EDGE_STYLE[EdgeType.EXPOSES]).toEqual({
      color: '#fbbf24',
      dash: 'dotted',
      arrow: true,
      width: 1.5,
    }); // warning-400
    expect(EDGE_STYLE[EdgeType.IMPORTS]).toEqual({
      color: '#505054',
      dash: 'dashed',
      arrow: false,
      width: 1,
    }); // surface-500
    expect(EDGE_STYLE[EdgeType.INVOKES]).toEqual({
      color: '#a78bfa',
      dash: 'dashed',
      arrow: true,
      width: 1.5,
    }); // violet-400 — inferred service invocation (approximate)
    expect(EDGE_STYLE[EdgeType.INJECTS]).toEqual({
      color: '#22d3ee',
      dash: 'solid',
      arrow: true,
      width: 1.5,
    }); // cyan-400 — DI constructor injection
  });

  it('translates dash styles into SVG dasharrays', () => {
    expect(dashArray('solid')).toBeUndefined();
    expect(dashArray('dashed')).toBe('6 4');
    expect(dashArray('dotted')).toBe('2 2');
  });
});

describe('custom edge components (6 types)', () => {
  for (const type of Object.values(EdgeType)) {
    it(`renders ${type} with the configured stroke, dash and arrow`, () => {
      const Component = edgeTypes[type];
      const edge = makeEdge(type);

      render(<Component {...makeEdgeProps(edge)} />);

      const path = screen.getByTestId(`edge-path-${edge.id}`);
      const config = EDGE_STYLE[type];

      expect(path.getAttribute('data-stroke')).toBe(config.color);
      if (config.dash === 'solid') {
        expect(path.getAttribute('data-dash')).toBeFalsy();
      } else {
        expect(path.getAttribute('data-dash')).toBe(dashArray(config.dash));
      }
      if (config.arrow) {
        expect(path.getAttribute('data-has-marker')).toBe('true');
      } else {
        expect(path.getAttribute('data-has-marker')).toBeFalsy();
      }
    });
  }

  it('thickens and shows type label on hover (REQ-VI-002)', () => {
    const Component = edgeTypes[EdgeType.DEPENDS_ON];
    const edge = makeEdge(EdgeType.DEPENDS_ON);

    render(<Component {...makeEdgeProps(edge)} />);

    const group = screen.getByTestId(`edge-group-${edge.id}`);
    expect(group.getAttribute('data-hovered')).toBeFalsy();
    expect(screen.queryByTestId(`edge-label-${edge.id}`)).not.toBeInTheDocument();

    fireEvent.mouseEnter(group);

    expect(group.getAttribute('data-hovered')).toBe('true');
    expect(screen.getByTestId(`edge-label-${edge.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`edge-label-${edge.id}`)).toHaveTextContent('DEPENDS_ON');

    fireEvent.mouseLeave(group);

    expect(group.getAttribute('data-hovered')).toBeFalsy();
    expect(screen.queryByTestId(`edge-label-${edge.id}`)).not.toBeInTheDocument();
  });
});

// REQ-VV-007/009: the request-flow lifecycle edges (endpoint → guard → pipe →
// handler → service) must show their type label on hover just like the base
// graph edges — the label identifies how each step connects to the next.
const LIFECYCLE_EDGE_TYPES = [
  EdgeType.PROTECTS,
  EdgeType.TRANSFORMS,
  EdgeType.EXPOSES,
  EdgeType.INVOKES,
  EdgeType.INJECTS,
];

for (const type of LIFECYCLE_EDGE_TYPES) {
  it(`shows the type label on hover for lifecycle edge ${type}`, () => {
    const Component = edgeTypes[type];
    const edge = makeEdge(type);

    render(<Component {...makeEdgeProps(edge)} />);

    const group = screen.getByTestId(`edge-group-${edge.id}`);
    fireEvent.mouseEnter(group);

    expect(screen.getByTestId(`edge-label-${edge.id}`)).toHaveTextContent(type);

    fireEvent.mouseLeave(group);

    expect(screen.queryByTestId(`edge-label-${edge.id}`)).not.toBeInTheDocument();
  });
}
